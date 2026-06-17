/**
 * Immich REST API wrapper for BYO self-hosted Immich instances.
 * Users provide IMMICH_BASE_URL and IMMICH_API_KEY in their own MCP client config.
 */

const USER_AGENT = "ImmichJewishMCP/0.1";

export interface ImmichConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ApiError {
  error: string;
}

export interface MaybeApiError {
  error?: string;
}

export interface ImmichAsset {
  id: string;
  originalFileName?: string;
  type?: string;
  fileCreatedAt?: string;
  localDateTime?: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  exifInfo?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ImmichAlbum {
  id: string;
  albumName: string;
  description?: string;
  assetCount?: number;
  assets?: ImmichAsset[];
  [key: string]: unknown;
}

export interface SearchAssetsResult extends MaybeApiError {
  assets: ImmichAsset[];
  total?: number;
}

export interface ListAlbumsResult extends MaybeApiError {
  albums: ImmichAlbum[];
}

export interface ListAssetsResult extends MaybeApiError {
  assets: ImmichAsset[];
  album?: ImmichAlbum;
}

export interface AlbumMutationResult extends MaybeApiError {
  album?: ImmichAlbum;
}

export function getConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ImmichConfig | ApiError {
  const baseUrl = env.IMMICH_BASE_URL?.trim().replace(/\/+$/, "");
  const apiKey = env.IMMICH_API_KEY?.trim();

  if (!baseUrl) return { error: "IMMICH_BASE_URL is required" };
  if (!apiKey) return { error: "IMMICH_API_KEY is required" };

  return { baseUrl, apiKey };
}

async function immichRequest<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: Record<string, unknown>;
    query?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<T | ApiError> {
  const config = getConfigFromEnv();
  if ("error" in config) return config;

  const { method = "GET", body, query } = options;
  const url = new URL(`${config.baseUrl}/api/${endpoint.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "x-api-key": config.apiKey
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { error: `Immich HTTP ${response.status}: ${response.statusText}${text ? ` — ${text.slice(0, 300)}` : ""}` };
    }

    if (response.status === 204) return {} as T;
    return (await response.json()) as T;
  } catch (error) {
    return { error: `Immich request failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function hasError(value: unknown): value is ApiError {
  return Boolean(value && typeof value === "object" && "error" in value);
}

export async function searchAssets(input: {
  query?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<SearchAssetsResult> {
  const body: Record<string, unknown> = {
    size: Math.min(Math.max(input.limit ?? 25, 1), 100),
    page: 1,
    query: input.query || input.eventType || undefined,
    takenAfter: input.startDate,
    takenBefore: input.endDate
  };

  const data = await immichRequest<{ assets?: { items?: ImmichAsset[]; total?: number } }>("search/metadata", {
    method: "POST",
    body
  });
  if (hasError(data)) return { assets: [], error: data.error };

  const assets = data.assets?.items ?? [];
  return { assets, total: data.assets?.total ?? assets.length };
}

export async function listAlbums(): Promise<ListAlbumsResult> {
  const data = await immichRequest<ImmichAlbum[]>("albums");
  if (hasError(data)) return { albums: [], error: data.error };
  return { albums: Array.isArray(data) ? data : [] };
}

export async function listAssets(input: { albumId?: string; limit?: number } = {}): Promise<ListAssetsResult> {
  if (input.albumId) {
    const album = await immichRequest<ImmichAlbum>(`albums/${encodeURIComponent(input.albumId)}`);
    if (hasError(album)) return { assets: [], error: album.error };
    return { album, assets: (album.assets ?? []).slice(0, input.limit ?? 100) };
  }

  const result = await searchAssets({ limit: input.limit ?? 50 });
  return { assets: result.assets, error: result.error };
}

export async function createAlbum(input: {
  albumName: string;
  description?: string;
  assetIds?: string[];
}): Promise<AlbumMutationResult> {
  const album = await immichRequest<ImmichAlbum>("albums", {
    method: "POST",
    body: {
      albumName: input.albumName,
      description: input.description,
      assetIds: input.assetIds ?? []
    }
  });
  if (hasError(album)) return { error: album.error };
  return { album };
}

export async function labelAlbum(input: {
  albumId: string;
  albumName?: string;
  description?: string;
  addAssetIds?: string[];
}): Promise<AlbumMutationResult> {
  let album: ImmichAlbum | undefined;

  if (input.albumName || input.description) {
    const updated = await immichRequest<ImmichAlbum>(`albums/${encodeURIComponent(input.albumId)}`, {
      method: "PATCH",
      body: {
        albumName: input.albumName,
        description: input.description
      }
    });
    if (hasError(updated)) return { error: updated.error };
    album = updated;
  }

  if (input.addAssetIds?.length) {
    const added = await immichRequest<unknown>(`albums/${encodeURIComponent(input.albumId)}/assets`, {
      method: "PUT",
      body: { ids: input.addAssetIds }
    });
    if (hasError(added)) return { error: added.error };
  }

  if (!album) {
    const fetched = await immichRequest<ImmichAlbum>(`albums/${encodeURIComponent(input.albumId)}`);
    if (hasError(fetched)) return { error: fetched.error };
    album = fetched;
  }

  return { album };
}
