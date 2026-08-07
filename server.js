const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------------
//  M3U Parser — extracts name, id, cookie per channel
// -------------------------------------------------------
function parseM3U(content) {
  const lines = content.split("\n");
  const channels = [];

  let currentChannel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // ── #EXTINF line ────────────────────────────────────
    if (line.startsWith("#EXTINF:")) {
      // tvg-id="1691"
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/);
      const id = tvgIdMatch ? tvgIdMatch[1] : null;

      // Channel name is everything after the LAST comma
      const nameMatch = line.match(/,(.+)$/);
      const name = nameMatch ? nameMatch[1].trim() : null;

      currentChannel = { name, id, cookie: null };
    }

    // ── #EXTHTTP line ───────────────────────────────────
    else if (line.startsWith("#EXTHTTP:") && currentChannel) {
      try {
        const jsonStr = line.replace("#EXTHTTP:", "").trim();
        const httpData = JSON.parse(jsonStr);
        currentChannel.cookie = httpData.cookie || null;
      } catch (_) {
        // malformed JSON — skip
      }
    }

    // ── Stream URL line → commit channel ────────────────
    else if (
      !line.startsWith("#") &&
      line.startsWith("http") &&
      currentChannel
    ) {
      channels.push(currentChannel);
      currentChannel = null;
    }
  }

  return channels;
}

// -------------------------------------------------------
//  Routes
// -------------------------------------------------------

/**
 * GET /channels
 * Query param: url  (the M3U source URL)
 * Example: /channels?url=https://tataplayyash.streamxlive.workers.dev/
 */
app.get("/channels", async (req, res) => {
  const sourceUrl = req.query.url;

  if (!sourceUrl) {
    return res.status(400).json({
      error: "Missing required query parameter: url",
      example: "/channels?url=https://tataplayyash.streamxlive.workers.dev/",
    });
  }

  try {
    const response = await axios.get(sourceUrl, {
      timeout: 30000,
      headers: {
        "User-Agent": "plaYtv/7.1.3 (Linux;Android 13)",
      },
      responseType: "text",
    });

    const m3uContent = response.data;
    const channels = parseM3U(m3uContent);

    return res.json({
      total: channels.length,
      source: sourceUrl,
      channels,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Failed to fetch or parse M3U source",
      detail: err.message,
    });
  }
});

/**
 * GET /
 * Health check
 */
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    usage: "GET /channels?url=<m3u_source_url>",
  });
});

// -------------------------------------------------------
//  Start server
// -------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅  M3U Parser API running on port ${PORT}`);
});
