import express from "express";

const app = express();

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_URL = process.env.UPSTREAM_URL || "https://jiotvplusapi.vvishwas042.workers.dev";

// Non-secret, fixed service defaults kept in code.
const REQUEST_TIMEOUT_MS = 30000;
const CORS_ORIGIN = "*";
const FORWARD_HEADER_NAMES = ["accept", "user-agent"];
const UPSTREAM_STATIC_HEADERS = {};

function setCors(res) {
res.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie, X-Requested-With");
res.setHeader("Access-Control-Max-Age", "86400");
res.setHeader("Vary", "Origin");
}

function normalizeUpstreamUrl(value) {
try {
const url = new URL(value);
if (!["http:", "https:"].includes(url.protocol)) return null;
return url;
} catch {
return null;
}
}

function buildUpstreamHeaders(req) {
const headers = new Headers();

for (const name of FORWARD_HEADER_NAMES) {
const value = req.headers[name];
if (typeof value === "string" && value.length > 0) {
headers.set(name, value);
}
}

for (const [name, value] of Object.entries(UPSTREAM_STATIC_HEADERS)) {
if (typeof value === "string" && value.length > 0) {
headers.set(name.toLowerCase(), value);
}
}

if (!headers.has("accept")) {
headers.set("accept", "application/json, text/plain, /");
}

if (!headers.has("user-agent")) {
headers.set("user-agent", "ProxyService/1.0");
}

return headers;
}

function renameTvgIdToId(value) {
if (Array.isArray(value)) {
return value.map(renameTvgIdToId);
}

if (value && typeof value === "object") {
const out = {};
for (const [key, val] of Object.entries(value)) {
const nextKey = key === "tvgId" ? "id" : key;
out[nextKey] = renameTvgIdToId(val);
}
return out;
}

return value;
}

async function readUpstreamJson(response) {
const contentType = response.headers.get("content-type") || "";
const rawText = await response.text();

try {
return JSON.parse(rawText);
} catch {
const looksJson = contentType.includes("application/json") || contentType.includes("+json");
if (!looksJson) {
throw new Error("Upstream returned non-JSON response");
}
throw new Error("Upstream returned invalid JSON");
}
}

app.use((req, res, next) => {
setCors(res);
if (req.method === "OPTIONS") return res.sendStatus(204);
next();
});

app.get("/health", (_req, res) => {
setCors(res);
res.status(200).json({ ok: true });
});

app.get("/proxy", async (req, res) => {
setCors(res);

const upstreamUrl = normalizeUpstreamUrl(UPSTREAM_URL);
if (!upstreamUrl) {
return res.status(500).json({
error: "Server configuration error",
message: "UPSTREAM_URL is missing or invalid"
});
}

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

try {
const upstreamResponse = await fetch(upstreamUrl.toString(), {
method: "GET",
headers: buildUpstreamHeaders(req),
redirect: "follow",
signal: controller.signal
});

if (!upstreamResponse.ok) {
  return res.status(502).json({
    error: "Upstream request failed",
    upstreamStatus: upstreamResponse.status
  });
}

const parsed = await readUpstreamJson(upstreamResponse);
const transformed = renameTvgIdToId(parsed);

res.status(200);
res.setHeader("Content-Type", "application/json; charset=utf-8");
return res.send(JSON.stringify(transformed));

} catch (err) {
const isTimeout = err?.name === "AbortError";
return res.status(isTimeout ? 504 : 502).json({
error: isTimeout ? "Upstream timeout" : "Proxy error",
message: isTimeout ? "The upstream request timed out" : (err?.message || "Unknown error")
});
} finally {
clearTimeout(timer);
}
});

app.use((_req, res) => {
setCors(res);
res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
console.log("Proxy service listening on port ${PORT}");
console.log("Upstream source: ${UPSTREAM_URL}");
});
