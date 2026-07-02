import { b64urlDecode, b64urlEncode, hmacSign, hmacVerify } from "./crypto.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

export const SESSION_COOKIE = "tk_session";
const MAX_AGE_S = 7 * 24 * 3600;

/** Dashboard session payload (signed into the cookie; never trusted unsigned). */
export interface Session {
  githubId: string;
  login: string;
  avatarUrl: string | null;
  /** Issued-at, epoch ms. */
  iat: number;
}

/** `<base64url(json)>.<hmac>`. */
export async function signSession(secret: string, s: Session): Promise<string> {
  const payload = b64urlEncode(enc.encode(JSON.stringify(s)));
  return `${payload}.${await hmacSign(secret, payload)}`;
}

async function verifySessionToken(secret: string, token: string): Promise<Session | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (!(await hmacVerify(secret, payload, sig))) return null;
  try {
    const s = JSON.parse(dec.decode(b64urlDecode(payload))) as Session;
    if (typeof s.iat !== "number" || s.iat + MAX_AGE_S * 1000 < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/** Read + verify the session cookie from a request. */
export async function readSession(secret: string, request: Request): Promise<Session | null> {
  const token = cookieValue(request.headers.get("Cookie"), SESSION_COOKIE);
  return token ? verifySessionToken(secret, token) : null;
}

export function sessionSetCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_S}`;
}

export function sessionClearCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
