// Wire shapes for the platform REST API (all under /api/platform/*), plus
// hand-rolled runtime guards. The dashboard must build and run against a
// half-finished backend, so every response is narrowed before use instead of
// trusted — a malformed/empty body surfaces as an error state, never a crash.

export interface Session {
  githubId: string;
  login: string;
  avatarUrl: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  prefix: string;
  createdAt: string;
  revokedAt: string | null;
}

/** Returned exactly once on creation — carries the full secret `key`. */
export interface CreatedApiKey {
  id: string;
  key: string;
  prefix: string;
  createdAt: string;
}

export interface UsageDay {
  day: string; // YYYY-MM-DD
  roomHours: number;
  peakCcu: number;
  messages: number;
}

export interface LiveRoom {
  roomId: string;
  type: string;
  count: number;
  maxClients: number;
}

export interface Limits {
  caps: {
    monthRoomHours: number;
    concurrentRooms: number;
    playersPerRoom: number;
  };
  monthRoomHours: number;
  liveRooms: number;
}

// --- narrowing helpers -----------------------------------------------------

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function parseSession(v: unknown): Session {
  if (!isObject(v) || !isString(v.githubId) || !isString(v.login) || !isString(v.avatarUrl)) {
    throw new Error("malformed session response");
  }
  return { githubId: v.githubId, login: v.login, avatarUrl: v.avatarUrl };
}

export function parseProject(v: unknown): Project {
  if (!isObject(v) || !isString(v.id) || !isString(v.name) || !isString(v.createdAt)) {
    throw new Error("malformed project");
  }
  return { id: v.id, name: v.name, createdAt: v.createdAt };
}

export function parseProjects(v: unknown): Project[] {
  if (!Array.isArray(v)) throw new Error("malformed projects response");
  return v.map(parseProject);
}

export function parseApiKey(v: unknown): ApiKey {
  if (!isObject(v) || !isString(v.id) || !isString(v.prefix) || !isString(v.createdAt)) {
    throw new Error("malformed api key");
  }
  const revokedAt = v.revokedAt;
  return {
    id: v.id,
    prefix: v.prefix,
    createdAt: v.createdAt,
    revokedAt: isString(revokedAt) ? revokedAt : null,
  };
}

export function parseApiKeys(v: unknown): ApiKey[] {
  if (!Array.isArray(v)) throw new Error("malformed api keys response");
  return v.map(parseApiKey);
}

export function parseCreatedApiKey(v: unknown): CreatedApiKey {
  if (
    !isObject(v) ||
    !isString(v.id) ||
    !isString(v.key) ||
    !isString(v.prefix) ||
    !isString(v.createdAt)
  ) {
    throw new Error("malformed created key response");
  }
  return { id: v.id, key: v.key, prefix: v.prefix, createdAt: v.createdAt };
}

export function parseUsage(v: unknown): UsageDay[] {
  if (!Array.isArray(v)) throw new Error("malformed usage response");
  return v.map((d) => {
    if (!isObject(d) || !isString(d.day) || !isNumber(d.roomHours) || !isNumber(d.peakCcu) || !isNumber(d.messages)) {
      throw new Error("malformed usage day");
    }
    return { day: d.day, roomHours: d.roomHours, peakCcu: d.peakCcu, messages: d.messages };
  });
}

export function parseLiveRooms(v: unknown): LiveRoom[] {
  if (!Array.isArray(v)) throw new Error("malformed rooms response");
  return v.map((r) => {
    if (!isObject(r) || !isString(r.roomId) || !isString(r.type) || !isNumber(r.count) || !isNumber(r.maxClients)) {
      throw new Error("malformed room");
    }
    return { roomId: r.roomId, type: r.type, count: r.count, maxClients: r.maxClients };
  });
}

export function parseLimits(v: unknown): Limits {
  if (!isObject(v) || !isObject(v.caps)) throw new Error("malformed limits response");
  const caps = v.caps;
  if (
    !isNumber(caps.monthRoomHours) ||
    !isNumber(caps.concurrentRooms) ||
    !isNumber(caps.playersPerRoom) ||
    !isNumber(v.monthRoomHours) ||
    !isNumber(v.liveRooms)
  ) {
    throw new Error("malformed limits response");
  }
  return {
    caps: {
      monthRoomHours: caps.monthRoomHours,
      concurrentRooms: caps.concurrentRooms,
      playersPerRoom: caps.playersPerRoom,
    },
    monthRoomHours: v.monthRoomHours,
    liveRooms: v.liveRooms,
  };
}
