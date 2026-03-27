export interface GithubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  expires_in: number;
}

export interface GithubOAuthToken {
  access_token: string;
  token_type: string;
  scope: string;
}

export class GithubOAuthError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = "GithubOAuthError";
  }
}

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

async function ghFetch(
  url: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new GithubOAuthError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const error = data.error as string | undefined;
    const description = (data.error_description as string | undefined) ?? error ?? "Unknown error";
    throw new GithubOAuthError(description, error);
  }

  return data;
}

export async function initiateGithubDeviceFlow(
  clientId: string,
): Promise<GithubDeviceCodeResponse> {
  const data = await ghFetch(DEVICE_CODE_URL, {
    client_id: clientId,
    scope: "read:user",
  });

  return {
    device_code: data.device_code as string,
    user_code: data.user_code as string,
    verification_uri: data.verification_uri as string,
    interval: data.interval as number,
    expires_in: data.expires_in as number,
  };
}

export async function exchangeGithubDeviceCode(
  clientId: string,
  deviceCode: string,
): Promise<GithubOAuthToken> {
  const data = await ghFetch(ACCESS_TOKEN_URL, {
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  });

  return {
    access_token: data.access_token as string,
    token_type: data.token_type as string,
    scope: data.scope as string,
  };
}

const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function pollFetch(
  clientId: string,
  deviceCode: string,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
  } catch (err) {
    throw new GithubOAuthError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

export async function pollGithubDeviceToken(
  clientId: string,
  deviceCode: string,
  intervalSeconds: number,
  signal?: AbortSignal,
): Promise<GithubOAuthToken> {
  const intervalMs = intervalSeconds * 1000;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (!signal?.aborted && Date.now() < deadline) {
    let data: Record<string, unknown>;
    try {
      data = await pollFetch(clientId, deviceCode);
    } catch (err) {
      if (err instanceof GithubOAuthError) {
        throw err;
      }
      throw new GithubOAuthError(
        err instanceof Error ? err.message : String(err),
      );
    }

    const error = data.error as string | undefined;

    if (!error) {
      return {
        access_token: data.access_token as string,
        token_type: data.token_type as string,
        scope: data.scope as string,
      };
    }

    if (error === "authorization_pending" || error === "slow_down") {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      continue;
    }

    if (error === "access_denied") {
      throw new GithubOAuthError("Authorization declined. Please try logging in again.", error);
    }

    if (error === "expired_token") {
      throw new GithubOAuthError("Authorization expired. Please try logging in again.", error);
    }

    throw new GithubOAuthError(
      (data.error_description as string | undefined) ?? `OAuth error: ${error}`,
      error,
    );
  }

  throw new GithubOAuthError("Authorization timed out. Please try logging in again.", "timeout");
}
