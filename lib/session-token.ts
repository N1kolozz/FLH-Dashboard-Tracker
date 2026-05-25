// Hand-rolled JWT implementation using the Web Crypto API (SubtleCrypto).
// We do NOT use the `jose` package — this avoids a Node.js-only dependency so
// the same code runs in the Next.js Edge Runtime (middleware) and Node.js server
// actions without any adapter shims.
//
// Token format: base64url(header) . base64url(payload) . base64url(HMAC-SHA256 signature)
// Algorithm:   HS256 (HMAC with SHA-256)

const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
const encoder = new TextEncoder();
const LOCAL_DEV_SESSION_SECRET = "flhub-local-dev-session-secret";
let warnedAboutMissingJwtSecret = false;

// Fields stored inside every session cookie. The server action layer and
// middleware both read from this shape — keep it stable.
export interface Session {
  userId: string;
  email: string;
  role: string;
  department: string;
  fullName: string;
}

// SessionClaims extends Session with standard JWT timing fields.
// iat = issued-at (Unix seconds), exp = expiry (Unix seconds).
type SessionClaims = Session & {
  iat: number;
  exp: number;
};

// Cache the imported CryptoKey across requests so we only call importKey once
// per process lifetime. The key is non-extractable (false) and scoped to
// sign + verify only.
let cachedSigningKey: Promise<CryptoKey> | null = null;

function getSecretKeyMaterial() {
  const secretKey = process.env.JWT_SECRET?.trim();
  if (secretKey) {
    return encoder.encode(secretKey);
  }

  // In development, fall back to a fixed secret so local dev works without
  // any .env.local setup. This secret is public — never use in production.
  if (process.env.NODE_ENV !== "production") {
    if (!warnedAboutMissingJwtSecret) {
      console.warn(
        "JWT_SECRET is not set; falling back to a local development session secret."
      );
      warnedAboutMissingJwtSecret = true;
    }

    return encoder.encode(LOCAL_DEV_SESSION_SECRET);
  }

  throw new Error("JWT_SECRET is required to sign and verify sessions in production");
}

function getSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API is not available in this runtime");
  }
  return subtle;
}

// Returns (and lazily initializes) the shared HMAC-SHA256 CryptoKey.
// Caching as a Promise means concurrent callers share one importKey call.
function getSigningKey() {
  if (!cachedSigningKey) {
    cachedSigningKey = getSubtleCrypto().importKey(
      "raw",
      getSecretKeyMaterial(),
      { name: "HMAC", hash: "SHA-256" },
      false,        // non-extractable: the raw key bytes can never be read back
      ["sign", "verify"]
    );
  }

  return cachedSigningKey;
}

// Converts a Uint8Array to a URL-safe base64 string (base64url, RFC 4648 §5).
// Standard base64 uses + and / which are special in URLs; base64url uses - and _.
// Trailing = padding is stripped because JWT decoders don't require it.
function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// Inverse of bytesToBase64Url — restores standard base64 padding before decoding.
function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeJson(value: unknown) {
  return bytesToBase64Url(encoder.encode(JSON.stringify(value)));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
  } catch {
    return null;
  }
}

// Validates and coerces every field from the decoded JWT payload into the
// expected Session shape. Returns null on any missing or malformed field so
// callers always get a fully-typed Session or nothing — never a partial object.
function normalizeSession(payload: Partial<SessionClaims> | null): Session | null {
  if (!payload) return null;
  if (!payload.email || !payload.role || !payload.department || !payload.fullName) {
    return null;
  }

  // userId is stored as a string in the JWT to avoid JSON number precision
  // issues, but we re-validate it as a positive safe integer here.
  const normalizedUserId = Number(payload.userId);
  if (!Number.isSafeInteger(normalizedUserId) || normalizedUserId <= 0) {
    return null;
  }

  return {
    userId: String(normalizedUserId),
    email: String(payload.email),
    role: String(payload.role),
    department: String(payload.department),
    fullName: String(payload.fullName),
  };
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

// Produces a signed JWT string from a Session payload.
// The signing input is "base64url(header).base64url(claims)" — exactly the
// format that HMAC covers, so any tampering with either part invalidates the sig.
export async function encrypt(payload: Session): Promise<string> {
  const now = nowInSeconds();
  const claims: SessionClaims = {
    userId: String(payload.userId),
    email: payload.email,
    role: payload.role,
    department: payload.department,
    fullName: payload.fullName,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const signingInput = `${encodeJson({ alg: "HS256", typ: "JWT" })}.${encodeJson(claims)}`;
  const signature = await getSubtleCrypto().sign(
    "HMAC",
    await getSigningKey(),
    encoder.encode(signingInput)
  );

  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

// Verifies a JWT string and returns the Session, or null if the token is
// malformed, tampered with, or expired. Never throws — always returns null
// on any failure so middleware can safely redirect to /login.
export async function decrypt(input: string): Promise<Session | null> {
  const [encodedHeader, encodedPayload, encodedSignature] = input.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const header = decodeJson<{ alg?: string; typ?: string }>(encodedHeader);
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    return null;
  }

  // SubtleCrypto.verify does a constant-time comparison internally,
  // so this is safe against timing attacks.
  const isValid = await getSubtleCrypto().verify(
    "HMAC",
    await getSigningKey(),
    base64UrlToBytes(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );

  if (!isValid) {
    return null;
  }

  const claims = decodeJson<SessionClaims>(encodedPayload);
  if (!claims || typeof claims.exp !== "number" || claims.exp <= nowInSeconds()) {
    return null;
  }

  return normalizeSession(claims);
}

export function getSessionMaxAgeSeconds() {
  return SESSION_MAX_AGE_SECONDS;
}
