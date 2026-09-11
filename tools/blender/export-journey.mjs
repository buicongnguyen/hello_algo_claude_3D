import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("./build_journey.py", import.meta.url));
const result = spawnSync(process.env.BLENDER_BIN || "blender", ["--background", "--python-exit-code", "1", "--python", script], { stdio: "inherit", windowsHide: true });
if (result.error) console.error("Set BLENDER_BIN to your Blender executable.");
process.exit(result.status ?? 1);
