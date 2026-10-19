/**
 * Точка входа bcs-server (Fastify). Единый внутренний контракт: contracts/broker-api.
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config.js";
import { registerErrorHandler } from "./plugins/errors.js";
import { systemRoutes } from "./routes/system.js";
import { portfolioRoutes } from "./routes/portfolio.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: config.corsOrigin.includes("*") ? true : config.corsOrigin,
    allowedHeaders: ["content-type", "authorization", "x-broker-refresh-token"],
    exposedHeaders: ["x-bcs-refresh-rotated"],
  });

  registerErrorHandler(app);
  await app.register(systemRoutes);
  await app.register(portfolioRoutes);

  return app;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "");
if (isMain || process.env.KIS_RUN === "1") {
  const app = await buildApp();
  await app.listen({ port: config.port, host: config.host });
}
