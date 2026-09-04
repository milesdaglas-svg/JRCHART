function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// YouTube needs zero network calls — the video ID is right there in the
// URL — so we resolve it entirely client-side and skip the backend.
// TikTok still has to go through the server: TikTok's own oEmbed endpoint
// doesn't allow direct browser requests (no CORS headers), so someone has
// to fetch it on the app's behalf — that's a TikTok restriction, not a
// choice we made.
export async function resolveEmbed(authedFetch, url) {
  let host;
  try {
    host = new URL(url).hostname.replace("www.", "");
  } catch {
    throw new Error("That doesn't look like a valid link");
  }

  if (host.includes("youtube.com") || host === "youtu.be") {
    const embedId = extractYouTubeId(url);
    if (!embedId) throw new Error("Couldn't find a video in that YouTube link");
    return { platform: "youtube", embedId };
  }

  return authedFetch(`/api/embeds/resolve?url=${encodeURIComponent(url)}`);
}