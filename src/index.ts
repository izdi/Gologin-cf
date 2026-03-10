import { Container } from "@cloudflare/containers";

// Cloudflare Containers beta — extend context typings
declare module "cloudflare:workers" {
  interface DurableObjectState {
    container: {
      running: boolean;
      start(options?: {
        env?: Record<string, string>;
      }): void;
      destroy(): Promise<void>;
    };
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
  url: string;
  screenWidth: number;
  screenHeight: number;
}

// ---------------------------------------------------------------------------
// Container Durable Object — manages a single Orbita browser instance
// ---------------------------------------------------------------------------

export class OrbitaContainer extends Container {
  defaultPort = 3500;
  sleepAfter = "30m";
  enableInternet = true;

  private applyConfig(config: ProfileConfig): void {
    (this as any).envVars = {
      TOKEN: config.token,
      PROFILE_ID: config.profileId,
      TARGET_URL: config.url || "about:blank",
      SCREEN_WIDTH: String(
        config.screenWidth || 1920,
      ),
      SCREEN_HEIGHT: String(
        config.screenHeight || 1080,
      ),
    };
  }

  override async fetch(
    request: Request,
  ): Promise<Response> {
    const path = new URL(request.url).pathname;

    // ---- internal management API ----

    if (path === "/__internal/configure") {
      const config =
        await request.json<ProfileConfig>();
      await this.ctx.storage.put("config", config);
      // Don't start here — container starts lazily
      // on the first CDP request via super.fetch()
      return Response.json(
        { status: "configured" },
        { status: 202 },
      );
    }

    if (path === "/__internal/status") {
      const config =
        await this.ctx.storage.get<ProfileConfig>(
          "config",
        );
      return Response.json({
        running: this.ctx.container.running,
        profileId: config?.profileId,
      });
    }

    if (path === "/__internal/stop") {
      await this.ctx.container.destroy();
      await this.ctx.storage.deleteAll();
      return Response.json({ status: "stopping" });
    }

    // ---- CDP proxy ----

    const config =
      await this.ctx.storage.get<ProfileConfig>(
        "config",
      );
    if (!config) {
      return Response.json(
        {
          error:
            "Profile not configured." +
            " POST /api/profiles/:id/start first.",
        },
        { status: 400 },
      );
    }

    // Set dynamic envVars before super.fetch()
    // auto-starts the container
    this.applyConfig(config);

    // super.fetch() starts container (if needed),
    // waits for defaultPort (3500), then proxies
    return super.fetch(request);
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
        const reqBody = request.body
          ? await request.json<{
              url?: string;
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
                url: reqBody.url || "about:blank",
                screenWidth:
                  reqBody.screenWidth ?? 1920,
                screenHeight:
                  reqBody.screenHeight ?? 1080,
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

    // --- container proxy: /c/:profileId/... ---
    // Proxies to the container's HTTP server on 3500
    // e.g. /c/:id/health, /c/:id/test

    const proxyRe = /^\/c\/([^/]+)(\/.*)?$/;
    const proxyMatch = path.match(proxyRe);

    if (proxyMatch) {
      const [, profileId, innerPath = "/"] = proxyMatch;
      const stub = env.ORBITA.getByName(profileId);
      const fwdUrl = new URL(request.url);
      fwdUrl.pathname = innerPath;
      return stub.fetch(
        new Request(fwdUrl.toString(), request),
      );
    }

    // --- root info ---

    if (path === "/") {
      return Response.json({
        service: "gologin-cf",
        endpoints: [
          "POST /api/profiles/:id/start",
          "GET  /api/profiles/:id/status",
          "POST /api/profiles/:id/stop",
          "GET  /c/:id/health",
          "GET  /c/:id/test",
        ],
      });
    }

    return Response.json(
      { error: "Not found" },
      { status: 404 },
    );
  },
};
