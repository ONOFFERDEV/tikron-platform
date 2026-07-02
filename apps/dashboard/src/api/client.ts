// Typed fetch wrapper for the platform API. Same-origin, cookie-session based
// (credentials: "include"). Everything goes through request(): JSON in/out,
// typed errors, and a global 401 signal that the session layer listens for.
import {
  parseApiKeys,
  parseCreatedApiKey,
  parseLimits,
  parseLiveRooms,
  parseProject,
  parseProjects,
  parseSession,
  parseUsage,
  type ApiKey,
  type CreatedApiKey,
  type Limits,
  type LiveRoom,
  type Project,
  type Session,
  type UsageDay,
} from "./types";

export const UNAUTHORIZED_EVENT = "pe:unauthorized";

/** Thrown for any non-2xx response (or a network/parse failure). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: "http" | "network" | "parse" = "http",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** True when the gateway itself couldn't be reached (dev proxy down, etc.). */
export function isUnreachable(err: unknown): boolean {
  return err instanceof ApiError && err.kind === "network";
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Suppress the global 401 event (used by the session probe itself). */
  silent401?: boolean;
}

async function request<T>(
  path: string,
  parse: (v: unknown) => T,
  opts: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, silent401 = false } = opts;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Fetch only rejects on network-level failure — the gateway is unreachable.
    throw new ApiError("gateway unreachable", 0, "network");
  }

  if (res.status === 401) {
    if (!silent401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw new ApiError("unauthorized", 401);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ApiError(detail || `request failed (${res.status})`, res.status);
  }

  if (res.status === 204) {
    return parse(undefined);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError("invalid JSON in response", res.status, "parse");
  }

  try {
    return parse(json);
  } catch (e) {
    throw new ApiError(e instanceof Error ? e.message : "malformed response", res.status, "parse");
  }
}

const P = "/api/platform";
const ok = () => undefined;

export const api = {
  /** Current session, or null when unauthenticated (401 is expected here). */
  async me(): Promise<Session | null> {
    try {
      return await request(`${P}/me`, parseSession, { silent401: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  /** Full-page GitHub OAuth entry point (used as an <a href>). */
  githubLoginUrl(): string {
    return `${P}/auth/github/login`;
  },

  /** Dev-mode login for local wrangler dev. */
  async devLogin(login: string): Promise<void> {
    await request(`${P}/auth/dev`, ok, { method: "POST", body: { login } });
  },

  /** Probe whether dev-mode login is offered by this backend. */
  async devLoginAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${P}/auth/dev`, { method: "OPTIONS", credentials: "include" });
      return res.ok || res.status === 405 || res.status === 400;
    } catch {
      return false;
    }
  },

  listProjects(): Promise<Project[]> {
    return request(`${P}/projects`, parseProjects);
  },

  createProject(name: string): Promise<Project> {
    return request(`${P}/projects`, parseProject, { method: "POST", body: { name } });
  },

  listKeys(projectId: string): Promise<ApiKey[]> {
    return request(`${P}/projects/${projectId}/keys`, parseApiKeys);
  },

  createKey(projectId: string): Promise<CreatedApiKey> {
    return request(`${P}/projects/${projectId}/keys`, parseCreatedApiKey, { method: "POST" });
  },

  revokeKey(projectId: string, keyId: string): Promise<void> {
    return request(`${P}/projects/${projectId}/keys/${keyId}`, ok, { method: "DELETE" });
  },

  usage(projectId: string, days = 30): Promise<UsageDay[]> {
    return request(`${P}/projects/${projectId}/usage?days=${days}`, parseUsage);
  },

  liveRooms(projectId: string): Promise<LiveRoom[]> {
    return request(`${P}/projects/${projectId}/rooms`, parseLiveRooms);
  },

  limits(projectId: string): Promise<Limits> {
    return request(`${P}/projects/${projectId}/limits`, parseLimits);
  },
};
