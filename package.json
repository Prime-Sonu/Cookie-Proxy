// server.js
import express from "express";

const app = express();
app.use(express.raw({ type: "*/*", limit: "25mb" }));

const PORT = process.env.PORT || 3000;
const PROXY_SECRET = process.env.PROXY_SECRET || "";
const ALLOWED_HOSTS = new Set(
  (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)
);

function isAllowedTarget(input) {
  try {
    const u = new URL(input);
    return ALLOWED_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

function safeForwardHeaders(req, targetUrl) {
  const headers = new Headers();

  const copyList = [
    "accept",
    "accept-language",
    "content-type",
    "user-agent",
    "referer",
    "origin",
    "authorization",
    "cookie",
    "x-requested-with"
  ];

  for (const name of copyList) {
    const value = req.headers[name];
    if (value) headers.set(name, value);
  }

  headers.set("accept", req.headers["accept"] || "*/*");
  headers.set("user-agent", req.headers["user-agent"] || "Mozilla/5.0");
  headers.set("origin", targetUrl.origin);
  headers.set("referer", targetUrl.origin + "/");

  if (PROXY_SECRET) {
    headers.set("x-proxy-secret", PROXY_SECRET);
  }

  return headers;
}

app.all("/proxy", async (req, res) => {
  const target = req.query.url;
  const token = req.query.token;

  if (!target || typeof target !== "string") {
    return res.status(400).send("Missing url");
  }

  if (PROXY_SECRET && token !== PROXY_SECRET) {
    return res.status(401).send("Bad proxy token");
  }

  if (!isAllowedTarget(target)) {
    return res.status(403).send("Target host not allowed");
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return res.status(400).send("Invalid url");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const headers = safeForwardHeaders(req, targetUrl);

    const init = {
      method: req.method,
      headers,
      redirect: "follow",
      signal: controller.signal
    };

    if (!["GET", "HEAD"].includes(req.method)) {
      init.body = req.body;
    }

    const upstream = await fetch(targetUrl.toString(), init);

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("access-control-allow-origin", "*");
    responseHeaders.set("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    responseHeaders.set("access-control-allow-headers", "Content-Type, Authorization, Cookie, X-Requested-With");
    responseHeaders.set("x-proxy-upstream-status", String(upstream.status));

    res.status(upstream.status);
    for (const [k, v] of responseHeaders.entries()) {
      try {
        res.setHeader(k, v);
      } catch {}
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    return res.send(body);
  } catch (err) {
    const msg = err?.name === "AbortError" ? "Upstream timeout" : "Proxy failed";
    return res.status(502).send(msg);
  } finally {
    clearTimeout(timeout);
  }
});

app.get("/health", (_, res) => res.status(200).send("ok"));

app.listen(PORT, () => {
  console.log(`Proxy listening on ${PORT}`);
});
