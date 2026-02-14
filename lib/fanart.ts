/**
 * Fanart.tv API client for fetching TV show artwork
 * API Documentation: https://fanart.tv/api-docs/tv-api/
 */

// Fanart.tv API key - consider moving to environment variables
const FANART_API_KEY = "98623ce0cb012c4c726d73f9c740e5e5";
const FANART_BASE_URL = "https://webservice.fanart.tv/v3";

export interface FanartTvShow {
  name: string;
  thetvdb_id: string;
  clearlogo?: FanartImage[];
  hdtvlogo?: FanartImage[];
  clearart?: FanartImage[];
  showbackground?: FanartImage[];
  tvthumb?: FanartImage[];
  seasonposter?: FanartImage[];
  seasonthumb?: FanartImage[];
  hdclearart?: FanartImage[];
  tvbanner?: FanartImage[];
  characterart?: FanartImage[];
  tvposter?: FanartImage[];
  seasonbanner?: FanartImage[];
}

export interface FanartMovie {
  name: string;
  tmdb_id: string;
  hdmovielogo?: FanartImage[];
  movielogo?: FanartImage[];
  moviedisc?: FanartImage[];
  movieposter?: FanartImage[];
  hdmovieclearart?: FanartImage[];
  movieart?: FanartImage[];
  moviebackground?: FanartImage[];
  moviebanner?: FanartImage[];
  moviethumb?: FanartImage[];
}

export interface FanartImage {
  id: string;
  url: string;
  lang: string;
  likes: string;
}

/**
 * Extract TVDB ID from Plex GUID
 * Plex GUIDs format: "com.plexapp.agents.thetvdb://123456?lang=en"
 * or "plex://show/5d9c086c46115600204557cf" (newer format)
 */
export function extractTvdbId(guid: string | undefined): string | null {
  if (!guid) return null;
  
  // Try old format: com.plexapp.agents.thetvdb://123456
  const tvdbMatch = guid.match(/thetvdb:\/\/(\d+)/);
  if (tvdbMatch) {
    return tvdbMatch[1];
  }
  
  // For newer Plex GUIDs, we need to extract from Guid array if available
  return null;
}

/**
 * Extract TVDB ID from Plex metadata Guid array
 * metadata.Guid format: [{ id: "tvdb://123456" }, { id: "imdb://tt1234567" }]
 */
export function extractTvdbIdFromGuids(guids: Array<{ id: string }> | undefined): string | null {
  if (!guids || guids.length === 0) return null;
  
  for (const guid of guids) {
    const match = guid.id.match(/tvdb:\/\/(\d+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Extract TMDB ID from Plex GUID
 * Plex GUIDs format: "com.plexapp.agents.themoviedb://123456?lang=en"
 */
export function extractTmdbId(guid: string | undefined): string | null {
  if (!guid) return null;
  
  const tmdbMatch = guid.match(/themoviedb:\/\/(\d+)/);
  if (tmdbMatch) {
    return tmdbMatch[1];
  }
  
  return null;
}

/**
 * Extract TMDB ID from Plex metadata Guid array
 * metadata.Guid format: [{ id: "tmdb://123456" }, { id: "imdb://tt1234567" }]
 */
export function extractTmdbIdFromGuids(guids: Array<{ id: string }> | undefined): string | null {
  if (!guids || guids.length === 0) return null;
  
  for (const guid of guids) {
    const match = guid.id.match(/tmdb:\/\/(\d+)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Fetch TV show artwork from Fanart.tv via Next.js API route (avoids CORS)
 */
export async function fetchTvShowArtwork(tvdbId: string): Promise<FanartTvShow | null> {
  try {
    const response = await fetch(`/api/fanart/${tvdbId}`, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch movie artwork from Fanart.tv via Next.js API route (avoids CORS)
 */
export async function fetchMovieArtwork(tmdbId: string): Promise<FanartMovie | null> {
  try {
    const response = await fetch(`/api/fanart/movie/${tmdbId}`, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch {
    return null;
  }
}

/**
 * Get the best available logo from Fanart.tv data
 * Priority: English language > hdtvlogo > clearlogo
 */
export function getBestLogo(artwork: FanartTvShow | null): string | null {
  if (!artwork) return null;

  // Try HD TV logo first (preferred)
  if (artwork.hdtvlogo && artwork.hdtvlogo.length > 0) {
    // Filter by English language first, then sort by likes
    const englishLogos = artwork.hdtvlogo.filter((logo) => logo.lang === "en");
    if (englishLogos.length > 0) {
      const sorted = [...englishLogos].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
      return sorted[0].url;
    }
    // Fallback to any language if no English available
    const sorted = [...artwork.hdtvlogo].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
    return sorted[0].url;
  }

  // Fallback to clear logo
  if (artwork.clearlogo && artwork.clearlogo.length > 0) {
    // Filter by English language first, then sort by likes
    const englishLogos = artwork.clearlogo.filter((logo) => logo.lang === "en");
    if (englishLogos.length > 0) {
      const sorted = [...englishLogos].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
      return sorted[0].url;
    }
    // Fallback to any language if no English available
    const sorted = [...artwork.clearlogo].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
    return sorted[0].url;
  }

  return null;
}

/**
 * Get the best available logo from movie Fanart.tv data
 * Priority: English language > hdmovielogo > movielogo
 */
export function getBestMovieLogo(artwork: FanartMovie | null): string | null {
  if (!artwork) return null;

  // Try HD movie logo first (preferred)
  if (artwork.hdmovielogo && artwork.hdmovielogo.length > 0) {
    // Filter by English language first, then sort by likes
    const englishLogos = artwork.hdmovielogo.filter((logo) => logo.lang === "en");
    if (englishLogos.length > 0) {
      const sorted = [...englishLogos].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
      return sorted[0].url;
    }
    // Fallback to any language if no English available
    const sorted = [...artwork.hdmovielogo].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
    return sorted[0].url;
  }

  // Fallback to movie logo
  if (artwork.movielogo && artwork.movielogo.length > 0) {
    // Filter by English language first, then sort by likes
    const englishLogos = artwork.movielogo.filter((logo) => logo.lang === "en");
    if (englishLogos.length > 0) {
      const sorted = [...englishLogos].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
      return sorted[0].url;
    }
    // Fallback to any language if no English available
    const sorted = [...artwork.movielogo].sort((a, b) => parseInt(b.likes) - parseInt(a.likes));
    return sorted[0].url;
  }

  return null;
}

/**
 * Get series logo URL from Plex metadata
 * This is a convenience function that combines all steps
 */
export async function getSeriesLogo(metadata: any): Promise<string | null> {
  // First try to extract TVDB ID from Guid array (new format)
  let tvdbId = extractTvdbIdFromGuids(metadata?.Guid);
  
  // Fallback to old guid format
  if (!tvdbId) {
    tvdbId = extractTvdbId(metadata?.guid);
  }
  
  if (!tvdbId) {
    return null;
  }

  const artwork = await fetchTvShowArtwork(tvdbId);
  return getBestLogo(artwork);
}

/**
 * Get movie logo URL from Plex metadata
 * This is a convenience function that combines all steps
 */
export async function getMovieLogo(metadata: any): Promise<string | null> {
  // First try to extract TMDB ID from Guid array (new format)
  let tmdbId = extractTmdbIdFromGuids(metadata?.Guid);
  
  // Fallback to old guid format
  if (!tmdbId) {
    tmdbId = extractTmdbId(metadata?.guid);
  }
  
  if (!tmdbId) {
    return null;
  }

  const artwork = await fetchMovieArtwork(tmdbId);
  return getBestMovieLogo(artwork);
}

/**
 * Get logo URL from Plex metadata (works for both shows and movies)
 */
export async function getContentLogo(metadata: any): Promise<string | null> {
  if (metadata?.type === "show") {
    return getSeriesLogo(metadata);
  } else if (metadata?.type === "movie") {
    return getMovieLogo(metadata);
  }
  return null;
}
