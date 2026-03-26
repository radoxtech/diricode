export class InvalidTokenError extends Error {
  constructor(message = "GitHub token is invalid or unauthorized") {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export interface GithubUserInfo {
  login: string;
  name?: string;
  avatar_url?: string;
}

export async function validateGithubToken(token: string): Promise<GithubUserInfo> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new InvalidTokenError(`GitHub token rejected with status ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, unknown>;

  return {
    login: data["login"] as string,
    name: data["name"] as string | undefined,
    avatar_url: data["avatar_url"] as string | undefined,
  };
}
