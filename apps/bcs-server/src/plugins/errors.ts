/**
 * Единый обработчик ошибок контракта UnifiedError (contracts/broker-api).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { UnifiedApiError, type UnifiedError } from "../types/unified.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: unknown, req: FastifyRequest, reply: FastifyReply) => {
    if (err instanceof UnifiedApiError) {
      const body: UnifiedError = { code: err.code, message: err.message };
      if (err.details) body.details = err.details;
      return reply.status(err.status).send(body);
    }
    req.log.error(err);
    const body: UnifiedError = { code: "INTERNAL", message: "Внутренняя ошибка bcs-server" };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((req, reply) => {
    const body: UnifiedError = { code: "INTERNAL", message: `Неизвестный путь ${req.method} ${req.url}` };
    return reply.status(404).send(body);
  });
}

export function readRefreshTokenHeader(req: FastifyRequest): string | null {
  const h = req.headers["x-broker-refresh-token"];
  const v = Array.isArray(h) ? h[0] : h;
  return v && v.trim().length > 0 ? v.trim() : null;
}
