const { generateKeyPairSync } = require("crypto");

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  publicKeyEncoding: { format: "jwk" },
  privateKeyEncoding: { format: "jwk" },
});

const rawPublicKey = Buffer.concat([
  Buffer.from([0x04]),
  fromBase64Url(publicKey.x),
  fromBase64Url(publicKey.y),
]);

console.log("Add these to your .env.local file:");
console.log("");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${toBase64Url(rawPublicKey)}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey.d}`);
console.log("VAPID_SUBJECT=mailto:you@example.com");
