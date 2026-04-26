import { fileURLToPath } from "url";
import { dirname, join } from "path";
console.log(import.meta.resolve("@github/copilot/sdk"));
const sdkPath = fileURLToPath(import.meta.resolve("@github/copilot/sdk"));
console.log(join(dirname(dirname(sdkPath)), "index.js"));
