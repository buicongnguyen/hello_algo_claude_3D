// Runs a Blender build script headless. --factory-startup ignores the user's add-ons and startup file,
// arguments after the npm script name are forwarded (`npm run assets:journey -- city reef`), and a
// timeout keeps a hung Blender from blocking forever (BLENDER_TIMEOUT_MS, default 30 minutes).
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function runBlender(scriptName, args = process.argv.slice(2)) {
  const executable = process.env.BLENDER_BIN || "blender";
  const script = fileURLToPath(new URL(`./${scriptName}`, import.meta.url));
  const timeout = Number(process.env.BLENDER_TIMEOUT_MS) || 30 * 60 * 1000;
  const result = spawnSync(executable, ["--background", "--factory-startup", "--python-exit-code", "1", "--python", script, "--", ...args],
    { stdio: "inherit", windowsHide: true, timeout, killSignal: "SIGKILL" });
  if (result.error?.code === "ETIMEDOUT") {
    console.error(`Blender did not finish ${scriptName} within ${Math.round(timeout / 60000)} minutes.`);
    return 1;
  }
  if (result.error) {
    console.error("Blender could not start. Put Blender on PATH or set BLENDER_BIN to the Blender executable.");
    return 1;
  }
  return result.status ?? 1;
}
