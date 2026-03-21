import { createApp } from "./server.js";

export type { ApiEnvelope, ErrorEnvelope, SuccessEnvelope } from "./middleware/error.js";
export { createApp } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = createApp();

export default {
  port: PORT,
  fetch: app.fetch,
};
