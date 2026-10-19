import { describe, it, expect } from "vitest";
import { createServer } from "node:http";

let calls = 0;

async function startMockKeycloak(): Promise<{ url: string; close: () => void }> {
  const srv = createServer((req, res) => {
    calls++;
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (body.includes("good")) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          access_token: "AT-" + calls, expires_in: 3600, refresh_expires_in: 7776000,
          refresh_token: "ROTATED-" + calls, token_type: "Bearer",
        }));
      } else {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "invalid_grant", error_description: "Token expired or not valid" }));
      }
    });
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const port = (srv.address() as { port: number }).port;
  return { url: `http://127.0.0.1:${port}/token`, close: () => srv.close() };
}

describe("keycloak token exchange", () => {
  it("exchanges, caches and reports rotation", async () => {
    const mock = await startMockKeycloak();
    process.env.BCS_KEYCLOAK_URL = mock.url;
    const { getAccessToken, _clearCache } = await import("../src/services/keycloak.js");
    _clearCache();
    calls = 0;

    const a1 = await getAccessToken("good-token");
    expect(a1.accessToken).toBe("AT-1");
    expect(a1.newRefreshToken).toBe("ROTATED-1");

    // из кэша — без нового обращения
    const a2 = await getAccessToken("good-token");
    expect(a2.accessToken).toBe("AT-1");
    expect(calls).toBe(1);

    // невалидный refresh -> UnifiedApiError 401 UPSTREAM_UNAUTHORIZED
    await expect(getAccessToken("bad-token")).rejects.toMatchObject({
      status: 401,
      code: "UPSTREAM_UNAUTHORIZED",
    });
    mock.close();
  });
});
