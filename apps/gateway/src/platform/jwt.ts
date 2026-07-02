import { b64urlDecode, b64urlEncode, hmacSign, hmacVerify } from "./crypto.js";

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface JwtClaims {
  sub: string;
  iat: number;
  exp: number;
  [k: string]: unknown;
}

/** Sign an HS256 JWT. `iat`/`exp` are seconds since the epoch (JWT convention). */
export async function signJwt(secret: string, claims: JwtClaims): Promise<string> {
  const header = b64urlEncode(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64urlEncode(enc.encode(JSON.stringify(claims)));
  const data = `${header}.${payload}`;
  return `${data}.${await hmacSign(secret, data)}`;
}

/** Verify an HS256 JWT and its expiry. Returns the claims, or null when invalid. */
export async function verifyJwt(secret: string, token: string): Promise<JwtClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];
  if (!(await hmacVerify(secret, `${header}.${payload}`, sig))) return null;
  let claims: JwtClaims;
  try {
    claims = JSON.parse(dec.decode(b64urlDecode(payload))) as JwtClaims;
  } catch {
    return null;
  }
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) return null;
  return claims;
}
