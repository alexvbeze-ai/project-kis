/**
 * Системные endpoints контракта: health + мета брокера.
 */
import type { FastifyInstance } from "fastify";
import type { BrokerMeta } from "../types/unified.js";

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/health", async () => ({
    status: "ok",
    service: "bcs-server",
    ts: new Date().toISOString(),
  }));

  app.get("/v1/broker", async (): Promise<BrokerMeta> => ({
    code: "bcs",
    name: "Банк «БКС Мир инвестиций»",
    features: ["portfolio"],
  }));
}
