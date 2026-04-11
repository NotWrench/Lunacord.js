import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { GeniusOAuthHelper } from "../../../src/integrations/lyrics/providers/GeniusOAuthHelper";

const originalFetch = globalThis.fetch;

describe("GeniusOAuthHelper", () => {
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should exchange an OAuth code for a token", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            access_token: "token",
            token_type: "bearer",
            expires_in: 3600,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
      )
    ) as unknown as typeof fetch;

    await expect(
      GeniusOAuthHelper.exchangeCode({
        clientId: "client-id",
        clientSecret: "client-secret",
        code: "code",
        redirectUri: "https://example.com/callback",
      })
    ).resolves.toEqual({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
    });
  });

  it("should throw when the exchange fails", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 400, statusText: "Bad Request" }))
    ) as unknown as typeof fetch;

    await expect(
      GeniusOAuthHelper.exchangeCode({
        clientId: "client-id",
        clientSecret: "client-secret",
        code: "code",
        redirectUri: "https://example.com/callback",
      })
    ).rejects.toThrow("Failed to exchange Genius OAuth code");
  });
});
