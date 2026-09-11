import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const executable = process.env.BLENDER_BIN || "blender";
const script = fileURLToPath(new URL("./build_assets.py", import.meta.url));
const result = spawnSync(executable, ["--background", "--python-exit-code", "1", "--python", script], { stdio: "inherit", windowsHide: true });
if (result.error) {
  console.error("Blender could not start. Put Blender on PATH or set BLENDER_BIN to the Blender executable.");
  process.exit(1);
}
process.exit(result.status ?? 1);
