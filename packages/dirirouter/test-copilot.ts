import { CopilotProvider } from "./src/copilot/adapter.js";
import { getGithubToken } from "./src/copilot/auth.js";

async function run() {
  const token = getGithubToken();
  if (!token) {
    console.log("No token");
    return;
  }
  const provider = new CopilotProvider(token);
  const models = await provider.listModels();
  console.log(
    "Models:",
    models.map((m) => m.id),
  );
  await provider.stop();
}

run().catch(console.error);
