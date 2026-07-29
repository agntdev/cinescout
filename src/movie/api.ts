import type { SavedTitle } from "./store.js";

interface TmdbResult { id: number; media_type?: string; title?: string; name?: string; release_date?: string; first_air_date?: string; }
interface TmdbResponse { results?: TmdbResult[]; }

function key(): string | undefined {
  return typeof process === "undefined" ? undefined : process.env.TMDB_API_KEY;
}

function endpoint(path: string, params: Record<string, string>): string {
  const url = new URL(`https://api.themoviedb.org/3/${path}`);
  url.search = new URLSearchParams({ api_key: key()!, ...params }).toString();
  return url.toString();
}

export function searchConfigured(): boolean { return Boolean(key()); }

export async function searchTitles(query: string): Promise<SavedTitle[]> {
  const response = await fetch(endpoint("search/multi", { query, include_adult: "false" }));
  if (!response.ok) throw new Error("metadata search failed");
  const payload = await response.json() as TmdbResponse;
  return (payload.results ?? [])
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .slice(0, 6)
    .map((item) => ({ id: item.id, title: item.title ?? item.name ?? "Untitled", year: (item.release_date ?? item.first_air_date ?? "").slice(0, 4) || undefined, type: item.media_type as "movie" | "tv" }));
}

export interface ViewingOptions { trailer?: string; availability?: string; providers: string[]; publicDomain?: string; }

export async function viewingOptions(title: SavedTitle): Promise<ViewingOptions> {
  const kind = title.type === "movie" ? "movie" : "tv";
  const [videosResponse, providersResponse, idsResponse] = await Promise.all([
    fetch(endpoint(`${kind}/${title.id}/videos`, {})),
    fetch(endpoint(`${kind}/${title.id}/watch/providers`, {})),
    fetch(endpoint(`${kind}/${title.id}/external_ids`, {})),
  ]);
  const videos = videosResponse.ok ? await videosResponse.json() as { results?: Array<{ site?: string; type?: string; key?: string }> } : {};
  const providers = providersResponse.ok ? await providersResponse.json() as { results?: Record<string, { link?: string; flatrate?: Array<{ provider_name?: string }>; free?: Array<{ provider_name?: string }> }> } : {};
  const ids = idsResponse.ok ? await idsResponse.json() as { imdb_id?: string } : {};
  const region = providers.results?.US;
  const official = [...(region?.flatrate ?? []), ...(region?.free ?? [])].map((provider) => provider.provider_name).filter((name): name is string => Boolean(name));
  const trailer = videos.results?.find((video) => video.site === "YouTube" && (video.type === "Trailer" || video.type === "Teaser") && video.key)?.key;
  return { trailer: trailer ? `https://www.youtube.com/watch?v=${trailer}` : undefined, availability: region?.link, providers: [...new Set(official)], publicDomain: ids.imdb_id ? `https://archive.org/advancedsearch.php?q=identifier:${encodeURIComponent(ids.imdb_id)}&output=json` : undefined };
}
