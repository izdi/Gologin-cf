const GoLogin = require("gologin");

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

function heartbeat() {
  console.log(
    "alive | port 3000 | profile",
    process.env.PROFILE_ID,
  );
}

async function main() {
  console.log("GoLogin starting with profile", params.profile_id);
  await gl.start({
    uploadCookiesToServer: true,
    autoUpdateBrowser: false,
  });
  console.log("Browser ready on CDP port 3500");
  setInterval(heartbeat, 30_000);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
