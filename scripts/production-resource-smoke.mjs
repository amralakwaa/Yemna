import { createHmac } from "node:crypto";

const port = process.env.SMOKE_PORT || "3135";
const secret = process.env.JWT_SECRET;

if (!secret) throw new Error("JWT_SECRET must be set for the production smoke test");

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({ sub: "production-smoke-user", email: "smoke@example.invalid", role: "user", iat: now, exp: now + 120 });
const body = `${header}.${payload}`;
const signature = createHmac("sha256", secret).update(body).digest("base64url");
const token = `${body}.${signature}`;
const baseUrl = `http://127.0.0.1:${port}/api/v1`;

for (const path of ["/relationships/friends", "/notifications", "/media", "/media/albums", "/support/tickets", "/messages/conversations"]) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
}

console.log("production protected-resource smoke test passed");
