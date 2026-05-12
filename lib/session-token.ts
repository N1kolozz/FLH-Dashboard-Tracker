const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const LOCAL_DEV_SESSION_SECRET = "flhub-local-dev-session-secret";
let warnedAboutMissingJwtSecret = false;

export interface Session {
  userId: string;
  email: string;
  role: string;
  department: string;
  fullName: string;
}

type SessionClaims = Session & {
  iat: number;
  exp: number;
};

let cachedSigningKey: Promise<CryptoKey> | null = null;

function getSecretKeyMaterial() {
  const secretKey = process.env.JWT_SECRET?.trim();
  if (secretKey) {
    return encoder.encode(secretKey);
  }

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

function getSigningKey() {
  if (!cachedSigningKey) {
    cachedSigningKey = getSubtleCrypto().importKey(
      "raw",
      getSecretKeyMaterial(),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
  }

  return cachedSigningKey;
}

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

function normalizeSession(payload: Partial<SessionClaims> | null): Session | null {
  if (!payload) return null;
  if (!payload.email || !payload.role || !payload.department || !payload.fullName) {
    return null;
  }

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

export async function decrypt(input: string): Promise<Session | null> {
  const [encodedHeader, encodedPayload, encodedSignature] = input.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const header = decodeJson<{ alg?: string; typ?: string }>(encodedHeader);
  if (!header || header.alg !== "HS256" || header.typ !== "JWT") {
    return null;
  }

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
