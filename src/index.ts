import { Container } from "@cloudflare/containers";

interface Env {
  ORBITA: DurableObjectNamespace;
  API_KEY: string;
  GOLOGIN_TOKEN: string;
}

interface Config {
  token: string;
  profileId: string;
}

// -------------------------------------------------------
// Container DO — runs Orbita, takes screenshot, serves it
// -------------------------------------------------------

export class OrbitaContainer extends Container {
  defaultPort = 3500;
  sleepAfter = "5m";
  enableInternet = true;
  envVars: Record<string, string> = {};

  override async fetch(
    request: Request,
  ): Promise<Response> {
    const path = new URL(request.url).pathname;

    // Save config (called before the screenshot req)
    if (path === "/__internal/config") {
      const body = await request.json<Config>();
      await this.ctx.storage.put("config", body);
      return Response.json({ status: "ok" });
    }

    // All other requests → proxy to container
    const config =
      await this.ctx.storage.get<Config>("config");
    if (!config) {
      return Response.json(
        { error: "Not configured" },
        { status: 400 },
      );
    }

    // Pass secrets as container env vars
    this.envVars = {
      TOKEN: config.token,
      PROFILE_ID: config.profileId,
    };

    // super.fetch() auto-starts container, waits for
    // port 3500, then proxies the request
    return super.fetch(request);
  }
}

// -------------------------------------------------------
// Worker — single endpoint: GET /start/:profileId
// -------------------------------------------------------

export default {
  async fetch(
    request: Request,
    env: Env,
  ): Promise<Response> {
    const key = request.headers.get("X-API-Key");
    if (!key || key !== env.API_KEY) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const path = new URL(request.url).pathname;

    const m = path.match(
      /^\/start\/([a-zA-Z0-9]+)$/,
    );
    if (m) {
      const profileId = m[1];
      const stub = env.ORBITA.getByName(profileId);

      // 1. Save config into DO storage
      await stub.fetch(
        new Request("http://do/__internal/config", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: env.GOLOGIN_TOKEN,
            profileId,
          }),
        }),
      );

      // 2. Request screenshot — this starts the
      //    container and proxies to port 3500
      const reqUrl = new URL(request.url);
      const targetUrl =
        reqUrl.searchParams.get("url") ||
        "https://gosu.team";
      return stub.fetch(
        new Request(
          `http://do/screenshot?url=${encodeURIComponent(targetUrl)}`,
        ),
      );
    }

    return Response.json({
      service: "gologin-cf",
      usage: "GET /start/:profileId",
    });
  },
};
