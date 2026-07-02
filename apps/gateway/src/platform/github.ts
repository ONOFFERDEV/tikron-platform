// GitHub OAuth (web) — authorize URL + code→user exchange. Exercised only in real
// dev/prod with a registered OAuth app; tests use the dev-auth path instead.

export function githubAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${q.toString()}`;
}

export interface GithubUser {
  githubId: string;
  login: string;
  avatarUrl: string | null;
}

/** Exchange an OAuth code for the authenticated GitHub user. Null on any failure. */
export async function exchangeGithubCode(
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<GithubUser | null> {
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!tokenRes.ok) return null;
  const tok = (await tokenRes.json()) as { access_token?: string };
  if (!tok.access_token) return null;

  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tok.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "tikron-gateway",
    },
  });
  if (!userRes.ok) return null;
  const u = (await userRes.json()) as { id?: number; login?: string; avatar_url?: string };
  if (u.id === undefined || !u.login) return null;
  return { githubId: String(u.id), login: u.login, avatarUrl: u.avatar_url ?? null };
}
