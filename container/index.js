async function main() {
  const { default: GoLogin } = await import("gologin");

  const SCREEN_WIDTH = process.env.SCREEN_WIDTH || "1920";
  const SCREEN_HEIGHT = process.env.SCREEN_HEIGHT || "1080";

  const params = {
    token: process.env.TOKEN,
    profile_id: process.env.PROFILE_ID,
    remote_debugging_port: 3500,
    executablePath: "/usr/bin/orbita-browser/chrome",
    extra_params: [
      "--start-maximized",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--no-zygote",
      "--window-position=0,0",
      `--window-size=${SCREEN_WIDTH},${SCREEN_HEIGHT}`,
    ],
  };

  const gl = new GoLogin(params);

  console.log(
    "[node] GoLogin starting with profile",
    params.profile_id,
  );
  console.log("[node] executablePath:", params.executablePath);
  console.log("[node] DISPLAY:", process.env.DISPLAY);

  try {
    await gl.start({
      uploadCookiesToServer: true,
      autoUpdateBrowser: false,
    });
    console.log("[node] Browser ready on CDP port 3500");
    setInterval(() => {
      console.log(
        "alive | port 3500 | profile",
        process.env.PROFILE_ID,
      );
    }, 30_000);
  } catch (err) {
    console.error("[node] FATAL:", err.message || err);
    console.error("[node] Stack:", err.stack || "no stack");
    // Keep process alive for log capture
    setInterval(() => {}, 60_000);
  }
}

main();
