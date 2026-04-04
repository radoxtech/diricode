export interface GithubUser {
  login: string;
  name?: string;
  avatar_url?: string;
}

export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export async function validateGithubToken(token: string): Promise<GithubUser> {
  let response: Response;
  try {
    response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (err) {
    throw new InvalidTokenError(
      `Network error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new InvalidTokenError(`GitHub token rejected (HTTP ${String(response.status)})`);
  }

  if (!response.ok) {
    throw new InvalidTokenError(`GitHub API error (HTTP ${String(response.status)})`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  return {
    login: data.login as string,
    name: data.name as string | undefined,
    avatar_url: data.avatar_url as string | undefined,
  };
}
