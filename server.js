const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// ── Hardcoded M3U source ──────────────────────────────
const M3U_SOURCE = "https://vortextv.modsdone.com/cricfy.php/channels?url=https://tataplayyash.streamxlive.workers.dev/";

// ── Parser ────────────────────────────────────────────
function parseM3U(content) {
  const lines = content.split("\n");
  const channels = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.startsWith("#EXTINF:")) {
      const idMatch   = line.match(/tvg-id="([^"]+)"/);
      const nameMatch = line.match(/,(.+)$/);
      current = {
        name:   nameMatch ? nameMatch[1].trim() : null,
        id:     idMatch   ? idMatch[1]          : null,
        cookie: null,
      };
    } else if (line.startsWith("#EXTHTTP:") && current) {
      try {
        const data = JSON.parse(line.replace("#EXTHTTP:", "").trim());
        current.cookie = data.cookie || null;
      } catch (_) {}
    } else if (!line.startsWith("#") && line.startsWith("http") && current) {
      channels.push(current);
      current = null;
    }
  }

  return channels;
}

// ── Route ─────────────────────────────────────────────
app.get("/", async (_req, res) => {
  try {
    const response = await axios.get(M3U_SOURCE, {
      timeout: 30000,
      headers: { "User-Agent": "plaYtv/7.1.3 (Linux;Android 13)" },
      responseType: "text",
    });

    const channels = parseM3U(response.data);
    res.json({ total: channels.length, channels });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
