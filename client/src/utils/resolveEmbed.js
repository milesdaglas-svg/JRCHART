export async function resolveEmbed(authedFetch, url) {
  return authedFetch(`/api/embeds/resolve?url=${encodeURIComponent(url)}`);
}