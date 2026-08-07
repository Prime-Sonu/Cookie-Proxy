// server.js
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Put your own public URL here
const SOURCE_URL = "https://vortextv.modsdone.com/cricfy.php/channels?url=https://tataplayyash.streamxlive.workers.dev/";

app.use(cors());
app.use(express.json());

function parseM3U(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith("#EXTINF:")) {
      const commaIndex = line.lastIndexOf(",");
      const meta = commaIndex >= 0 ? line.slice(0, commaIndex) : line;
      const name = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : "";

      const attrs = {};
      const attrRegex = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
      let m;
      while ((m = attrRegex.exec(meta)) !== null) {
        attrs[m[1]] = m[2];
      }

      current = { name, ...attrs };
    } else if (line.startsWith("#")) {
      continue;
    } else {
      if (current) {
        current.url = line;
        items.push(current);
        current = null;
      }
    }
  }

  return items;
}

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    endpoints: ["/proxy", "/m3u-to-json"],
  });
});

app.get("/proxy", async (_req, res) => {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json,text/plain,*/*",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Upstream returned ${response.status}`,
      });
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      return res.json(data);
    }

    const text = await response.text();
    return res.type("text/plain").send(text);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.post("/m3u-to-json", (req, res) => {
  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({
      ok: false,
      error: "Missing 'text' in request body",
    });
  }

  try {
    const data = parseM3U(text);
    return res.json({
      ok: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
