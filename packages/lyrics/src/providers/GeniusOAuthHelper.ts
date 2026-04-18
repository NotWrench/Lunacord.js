import { z } from "zod";

const GeniusOAuthTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
});

export type GeniusOAuthTokenResponse = z.infer<typeof GeniusOAuthTokenResponseSchema>;

export interface GeniusOAuthExchangeOptions {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}

const GENIUS_OAUTH_TOKEN_URL = "https://api.genius.com/oauth/token";

const exchangeCode = async (
  options: GeniusOAuthExchangeOptions
): Promise<GeniusOAuthTokenResponse> => {
  const response = await fetch(GENIUS_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: options.code,
      client_id: options.clientId,
      client_secret: options.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: options.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to exchange Genius OAuth code: ${response.status} ${response.statusText}`
    );
  }

  const payload = await response.json();
  return GeniusOAuthTokenResponseSchema.parse(payload);
};

/** Helper for the Genius OAuth token exchange. */
export const GeniusOAuthHelper = {
  exchangeCode,
} as const;
