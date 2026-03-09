import { Container } from "@cloudflare/containers";

// Cloudflare Containers beta — extend context typings
declare module "cloudflare:workers" {
  interface DurableObjectState {
    container: { running: boolean };
  }
}

interface Env {
  ORBITA: DurableObjectNamespace;
  API_KEY: string;
  GOLOGIN_TOKEN: string;
}

interface ProfileConfig {
  token: string;
  profileId: string;
  screenWidth: number;
  screenHeight: number;
}

// ---------------------------------------------------------------------------
// Container Durable Object — manages a single Orbita browser instance
// ---------------------------------------------------------------------------

export class OrbitaContainer extends Container {
  defaultPort = 3500;
  requiredPorts = [3500];
  sleepAfter = "30m";
  enableInternet = true;

  override async fetch(
    request: Request,
  ): Promise<Response> {
    const path = new URL(request.url).pathname;

    // ---- internal management API (not proxied to Docker) ----

    if (path === "/__internal/configure") {
      const config = await request.json<ProfileConfig>();
      await this.ctx.storage.put("config", config);
      try {
        await this.ctx.blockConcurrencyWhile(
          () => this.ensureRunning(),
        );
        return Response.json({ status: "started" });
      } catch {
        // Container may still be starting — return 202
        return Response.json(
          { status: "starting" },
          { status: 202 },
        );
      }
    }

    if (path === "/__internal/status") {
      const config =
        await this.ctx.storage.get<ProfileConfig>("config");
      return Response.json({
        running: this.ctx.container.running,
        profileId: config?.profileId,
      });
    }

    if (path === "/__internal/stop") {
      await this.ctx.storage.deleteAll();
      return Response.json({ status: "stopping" });
    }

    // ---- CDP proxy — make sure the browser is up first ----

    try {
      await this.ctx.blockConcurrencyWhile(
        () => this.ensureRunning(),
      );
    } catch (err) {
      return Response.json(
        { error: (err as Error).message },
        { status: 400 },
      );
    }

    return super.fetch(request);
  }

  // Start the Docker container if it is not already running.
  private async ensureRunning(): Promise<void> {
    if (this.ctx.container.running) return;

    const config =
      await this.ctx.storage.get<ProfileConfig>("config");
    if (!config) {
      throw new Error(
        "Profile not configured. POST /api/profiles/:id/start first.",
      );
    }

    await this.startAndWaitForPorts({
      ports: [3500],
      startOptions: {
        envVars: {
          TOKEN: config.token,
          PROFILE_ID: config.profileId,
          SCREEN_WIDTH: String(config.screenWidth || 1920),
          SCREEN_HEIGHT: String(config.screenHeight || 1080),
        },
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Worker entry-point — routing, auth, CDP URL rewriting
// ---------------------------------------------------------------------------

function authenticate(
  request: Request,
  env: Env,
): Response | null {
  const key = request.headers.get("X-API-Key");
  if (!key || key !== env.API_KEY) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }
  return null;
}

async function rewriteCdpUrls(
  response: Response,
  workerUrl: URL,
  profileId: string,
): Promise<Response> {
  const body = await response.text();
  const origin =
    `${workerUrl.protocol}//${workerUrl.host}`;
  const wsOrigin = origin
    .replace("https://", "wss://")
    .replace("http://", "ws://");

  const rewritten = body
    .replace(
      /ws:\/\/127\.0\.0\.1:\d+/g,
      `${wsOrigin}/cdp/${profileId}`,
    )
    .replace(
      /http:\/\/127\.0\.0\.1:\d+/g,
      `${origin}/cdp/${profileId}`,
    );

  return new Response(rewritten, {
    status: response.status,
    headers: response.headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const authErr = authenticate(request, env);
    if (authErr) return authErr;

    const url = new URL(request.url);
    const path = url.pathname;

    // --- management API ---

    const apiRe =
      /^\/api\/profiles\/([^/]+)\/(start|stop|status)$/;
    const apiMatch = path.match(apiRe);

    if (apiMatch) {
      const [, profileId, action] = apiMatch;
      const stub = env.ORBITA.getByName(profileId);

      if (action === "start") {
        const reqBody = (request.body)
          ? await request.json<{
              screenWidth?: number;
              screenHeight?: number;
            }>()
          : {};
        return stub.fetch(
          new Request(
            "http://container/__internal/configure",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                token: env.GOLOGIN_TOKEN,
                profileId,
                screenWidth: reqBody.screenWidth ?? 1920,
                screenHeight: reqBody.screenHeight ?? 1080,
              }),
            },
          ),
        );
      }

      if (action === "stop") {
        return stub.fetch(
          new Request("http://container/__internal/stop"),
        );
      }

      // status
      return stub.fetch(
        new Request("http://container/__internal/status"),
      );
    }

    // --- CDP proxy: /cdp/:profileId/... ---

    const cdpRe = /^\/cdp\/([^/]+)(\/.*)?$/;
    const cdpMatch = path.match(cdpRe);

    if (cdpMatch) {
      const [, profileId, cdpPath = "/"] = cdpMatch;
      const stub = env.ORBITA.getByName(profileId);

      const fwdUrl = new URL(request.url);
      fwdUrl.pathname = cdpPath;

      const resp = await stub.fetch(
        new Request(fwdUrl.toString(), request),
      );

      const jsonPaths = [
        "/json",
        "/json/version",
        "/json/list",
      ];
      if (jsonPaths.includes(cdpPath)) {
        return rewriteCdpUrls(resp, url, profileId);
      }
      return resp;
    }

    // --- root info ---

    if (path === "/") {
      return Response.json({
        service: "gologin-cf",
        endpoints: [
          "POST /api/profiles/:id/start",
          "GET  /api/profiles/:id/status",
          "POST /api/profiles/:id/stop",
          "GET  /cdp/:id/json/version",
          "WS   /cdp/:id/devtools/browser/:bid",
        ],
      });
    }

    return Response.json(
      { error: "Not found" },
      { status: 404 },
    );
  },
};
