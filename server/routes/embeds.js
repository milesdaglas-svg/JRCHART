const express = require("express");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

router.get("/resolve", verifyToken, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "url is required" });

    let host;
    try {
      host = new URL(url).hostname.replace("www.", "");
    } catch {
      return res.status(400).json({ error: "That doesn't look like a valid link" });
    }

    if (host.includes("youtube.com") || host === "youtu.be") {
      const embedId = extractYouTubeId(url);
      if (!embedId) return res.status(400).json({ error: "Couldn't find a video in that YouTube link" });
      return res.json({ platform: "youtube", embedId });
    }

    if (host.includes("tiktok.com")) {
      const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
      if (!oembedRes.ok) return res.status(400).json({ error: "Couldn't load that TikTok video" });
      const data = await oembedRes.json();
      return res.json({ platform: "tiktok", embedHtml: data.html, thumbnail: data.thumbnail_url });
    }

    if (host.includes("instagram.com")) {
      return res.status(400).json({
        error: "Instagram links need extra setup (a Meta developer app) that isn't configured yet — YouTube and TikTok work now.",
      });
    }

    return res.status(400).json({ error: "Only YouTube and TikTok links are supported right now" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router };