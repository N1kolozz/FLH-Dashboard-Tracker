import "server-only";

import { createCipheriv, createECDH, createHmac, randomBytes } from "crypto";
import { importJWK, SignJWT } from "jose";
import { pool } from "@/lib/db";

export const PUSH_TOPIC_LABELS = {
  news: "News",
  events: "Events",
  projects: "Projects",
  attendance: "Attendance",
} as const;

export type PushTopic = keyof typeof PUSH_TOPIC_LABELS;

export type PushPreferences = Record<PushTopic, boolean>;

export interface BrowserPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  topic: PushTopic;
  url: string;
  tag: string;
  icon?: string;
  badge?: string;
}

type StoredSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PreferenceRow = {
  topic_news: boolean;
  topic_events: boolean;
  topic_projects: boolean;
  topic_attendance: boolean;
};

const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  news: true,
  events: true,
  projects: true,
  attendance: true,
};

const TOPIC_COLUMN_MAP: Record<PushTopic, string> = {
  news: "topic_news",
  events: "topic_events",
  projects: "topic_projects",
  attendance: "topic_attendance",
};

function toPreferences(row?: Partial<PreferenceRow> | null): PushPreferences {
  return {
    news: row?.topic_news ?? DEFAULT_PUSH_PREFERENCES.news,
    events: row?.topic_events ?? DEFAULT_PUSH_PREFERENCES.events,
    projects: row?.topic_projects ?? DEFAULT_PUSH_PREFERENCES.projects,
    attendance: row?.topic_attendance ?? DEFAULT_PUSH_PREFERENCES.attendance,
  };
}

function bufferToBase64Url(value: Uint8Array | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function hmacSha256(key: Uint8Array | Buffer, data: Uint8Array | Buffer) {
  return createHmac("sha256", key).update(data).digest();
}

function assertSubscription(subscription: BrowserPushSubscription): asserts subscription is BrowserPushSubscription & {
  keys: { p256dh: string; auth: string };
} {
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
    throw new Error("Invalid push subscription");
  }
}

export function getPublicPushKey() {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export function isPushConfigured() {
  try {
    return Boolean(getVapidConfig());
  } catch {
    return false;
  }
}

function getVapidConfig() {
  const publicKey = getPublicPushKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = normalizeVapidSubject(process.env.VAPID_SUBJECT);

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function normalizeVapidSubject(value?: string) {
  const subject = value?.trim() || "mailto:notifications@example.com";
  const normalizedSubject = subject.replace(/^mailto:(https?:\/\/.+)$/i, "$1");

  if (/^https?:\/\/\S+$/i.test(normalizedSubject)) {
    return normalizedSubject;
  }

  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalizedSubject)) {
    return normalizedSubject;
  }

  throw new Error(
    "VAPID_SUBJECT must be a URL like https://example.com or an email like mailto:admin@example.com"
  );
}

function vapidKeyToJwk(publicKey: string, privateKey: string) {
  const rawPublicKey = base64UrlToBuffer(publicKey);
  if (rawPublicKey.length !== 65 || rawPublicKey[0] !== 0x04) {
    throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY must be an uncompressed P-256 public key");
  }

  return {
    kty: "EC",
    crv: "P-256",
    x: bufferToBase64Url(rawPublicKey.subarray(1, 33)),
    y: bufferToBase64Url(rawPublicKey.subarray(33, 65)),
    d: privateKey,
  };
}

async function createVapidToken(endpoint: string) {
  const config = getVapidConfig();
  if (!config) {
    throw new Error("Push notifications are not configured");
  }

  const signingKey = await importJWK(
    vapidKeyToJwk(config.publicKey, config.privateKey),
    "ES256"
  );

  return new SignJWT({
    aud: new URL(endpoint).origin,
    sub: config.subject,
  })
    .setProtectedHeader({ alg: "ES256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(signingKey);
}

function encryptPushPayload(subscription: BrowserPushSubscription, payload: string) {
  assertSubscription(subscription);

  const clientPublicKey = base64UrlToBuffer(subscription.keys.p256dh);
  const authSecret = base64UrlToBuffer(subscription.keys.auth);
  const salt = randomBytes(16);

  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();

  const serverPublicKey = ecdh.getPublicKey(undefined, "uncompressed");
  const sharedSecret = ecdh.computeSecret(clientPublicKey);

  const prkKey = hmacSha256(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info", "utf8"),
    Buffer.from([0]),
    clientPublicKey,
    serverPublicKey,
  ]);
  const ikm = hmacSha256(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]));

  const prk = hmacSha256(salt, ikm);
  const cekInfo = Buffer.concat([
    Buffer.from("Content-Encoding: aes128gcm", "utf8"),
    Buffer.from([0, 1]),
  ]);
  const nonceInfo = Buffer.concat([
    Buffer.from("Content-Encoding: nonce", "utf8"),
    Buffer.from([0, 1]),
  ]);

  const contentEncryptionKey = hmacSha256(prk, cekInfo).subarray(0, 16);
  const nonce = hmacSha256(prk, nonceInfo).subarray(0, 12);

  const plaintext = Buffer.concat([Buffer.from(payload, "utf8"), Buffer.from([2])]);
  const recordSize = 4096;

  if (plaintext.length + 16 >= recordSize) {
    throw new Error("Push payload is too large");
  }

  const cipher = createCipheriv("aes-128-gcm", contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const header = Buffer.alloc(16 + 4 + 1 + serverPublicKey.length);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header.writeUInt8(serverPublicKey.length, 20);
  serverPublicKey.copy(header, 21);

  return Buffer.concat([header, ciphertext, authTag]);
}

function sanitizeTopic(tag: string) {
  return tag.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
}

export function createPushNotification(input: Omit<PushNotificationPayload, "icon" | "badge"> & {
  icon?: string;
  badge?: string;
}) {
  return {
    icon: input.icon ?? "/apple-touch-icon.png",
    badge: input.badge ?? "/pwa-icon/192",
    ...input,
  };
}

export async function syncPushSubscription(
  userId: number,
  subscription: BrowserPushSubscription,
  userAgent: string
) {
  assertSubscription(subscription);

  const result = await pool.query<PreferenceRow>(
    `INSERT INTO push_subscriptions (
       user_id,
       endpoint,
       p256dh,
       auth,
       user_agent,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (endpoint) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           user_agent = EXCLUDED.user_agent,
           updated_at = CURRENT_TIMESTAMP
     RETURNING topic_news, topic_events, topic_projects, topic_attendance`,
    [
      userId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
      userAgent,
    ]
  );

  return toPreferences(result.rows[0]);
}

export async function updatePushPreferences(
  userId: number,
  endpoint: string,
  preferences: PushPreferences
) {
  const result = await pool.query<PreferenceRow>(
    `UPDATE push_subscriptions
     SET topic_news = $1,
         topic_events = $2,
         topic_projects = $3,
         topic_attendance = $4,
         updated_at = CURRENT_TIMESTAMP
     WHERE endpoint = $5
       AND user_id = $6
     RETURNING topic_news, topic_events, topic_projects, topic_attendance`,
    [
      preferences.news,
      preferences.events,
      preferences.projects,
      preferences.attendance,
      endpoint,
      userId,
    ]
  );

  return toPreferences(result.rows[0]);
}

export async function deletePushSubscription(userId: number, endpoint: string) {
  await pool.query(
    `DELETE FROM push_subscriptions
     WHERE endpoint = $1
       AND user_id = $2`,
    [endpoint, userId]
  );
}

async function markPushSuccess(endpoint: string) {
  await pool.query(
    `UPDATE push_subscriptions
     SET last_success_at = CURRENT_TIMESTAMP,
         last_failure_at = NULL,
         last_failure_reason = '',
         updated_at = CURRENT_TIMESTAMP
     WHERE endpoint = $1`,
    [endpoint]
  );
}

async function markPushFailure(endpoint: string, reason: string, shouldDelete: boolean) {
  if (shouldDelete) {
    await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
    return;
  }

  await pool.query(
    `UPDATE push_subscriptions
     SET last_failure_at = CURRENT_TIMESTAMP,
         last_failure_reason = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE endpoint = $1`,
    [endpoint, reason.slice(0, 500)]
  );
}

export async function sendPushToSubscription(
  subscription: BrowserPushSubscription,
  payload: PushNotificationPayload
) {
  if (!isPushConfigured()) {
    return {
      ok: false,
      status: 503,
      shouldDelete: false,
      reason: "Push notifications are not configured",
    };
  }

  try {
    const token = await createVapidToken(subscription.endpoint);
    const encryptedPayload = encryptPushPayload(subscription, JSON.stringify(payload));
    const publicKey = getPublicPushKey();

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        TTL: "300",
        Urgency: "high",
        Topic: sanitizeTopic(payload.tag),
        Authorization: `vapid t=${token}, k=${publicKey}`,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
      },
      body: encryptedPayload,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        shouldDelete: false,
        reason: "",
      };
    }

    const reason = (await response.text()) || `Push endpoint returned ${response.status}`;
    return {
      ok: false,
      status: response.status,
      shouldDelete: response.status === 404 || response.status === 410,
      reason,
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      shouldDelete: false,
      reason: error instanceof Error ? error.message : "Unknown push error",
    };
  }
}

export async function notifySubscribers(options: {
  topic: PushTopic;
  payload: PushNotificationPayload;
  excludeUserId?: number | null;
  userIds?: number[];
}) {
  if (!isPushConfigured()) {
    return { sent: 0, failed: 0, skipped: true };
  }

  const params: unknown[] = [];
  const filters = [`${TOPIC_COLUMN_MAP[options.topic]} = TRUE`];

  if (options.userIds) {
    const userIds = Array.from(new Set(options.userIds)).filter((userId) =>
      Number.isInteger(userId)
    );

    if (userIds.length === 0) {
      return { sent: 0, failed: 0, skipped: false };
    }

    params.push(userIds);
    filters.push(`user_id = ANY($${params.length}::INTEGER[])`);
  }

  if (typeof options.excludeUserId === "number") {
    params.push(options.excludeUserId);
    filters.push(`(user_id IS NULL OR user_id <> $${params.length})`);
  }

  const result = await pool.query<StoredSubscriptionRow>(
    `SELECT endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE ${filters.join(" AND ")}`,
    params
  );

  let sent = 0;
  let failed = 0;

  await Promise.all(
    result.rows.map(async (row) => {
      const response = await sendPushToSubscription(
        {
          endpoint: row.endpoint,
          keys: {
            p256dh: row.p256dh,
            auth: row.auth,
          },
        },
        options.payload
      );

      if (response.ok) {
        sent += 1;
        await markPushSuccess(row.endpoint);
        return;
      }

      failed += 1;
      await markPushFailure(row.endpoint, response.reason, response.shouldDelete);
    })
  );

  return { sent, failed, skipped: false };
}
