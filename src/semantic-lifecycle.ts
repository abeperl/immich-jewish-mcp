/**
 * Semantic lifecycle layer — maps Immich photos to Jewish lifecycle events.
 *
 * Strategy (all advisory, never writes without user confirmation):
 *  1. EXIF date signals via Immich metadata (localDateTime / fileCreatedAt)
 *  2. Jewish holiday calendar windows (jewish-calendar.ts)
 *  3. Filename / album / caption keyword matching (jewish-lifecycle-taxonomy.ts)
 *  4. Date clustering: photos within a 3-day window form one event candidate
 *  5. Heuristics scored and ranked; user confirms before album creation
 */

import { ImmichAsset } from "./immich-api.js";
import { JEWISH_LIFECYCLE_TAXONOMY, findLifecycleMatches, JewishLifecycleEventType } from "./data/jewish-lifecycle-taxonomy.js";
import { getHolidaysForDate } from "./jewish-calendar.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// EXIF tool integration (local files)
// ---------------------------------------------------------------------------

export interface ExifData {
  dateTime?: string;     // ISO or EXIF-formatted date
  lat?: number;
  lon?: number;
  city?: string;
  country?: string;
  make?: string;
  model?: string;
}

/** Extract EXIF metadata from a local file using exiftool. */
export async function extractExif(filePath: string): Promise<ExifData> {
  try {
    const { stdout } = await execFileAsync("exiftool", [
      "-json",
      "-DateTimeOriginal",
      "-CreateDate",
      "-GPSLatitude#",
      "-GPSLongitude#",
      "-City",
      "-Country",
      "-Make",
      "-Model",
      filePath
    ], { timeout: 10_000 });

    const parsed = JSON.parse(stdout);
    if (!Array.isArray(parsed) || !parsed[0]) return {};
    const raw = parsed[0];

    const dateRaw: string | undefined = raw.DateTimeOriginal ?? raw.CreateDate;
    // Convert EXIF "YYYY:MM:DD HH:MM:SS" → ISO
    const dateTime = dateRaw
      ? dateRaw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
      : undefined;

    return {
      dateTime,
      lat: typeof raw.GPSLatitude === "number" ? raw.GPSLatitude : undefined,
      lon: typeof raw.GPSLongitude === "number" ? raw.GPSLongitude : undefined,
      city: typeof raw.City === "string" ? raw.City : undefined,
      country: typeof raw.Country === "string" ? raw.Country : undefined,
      make: typeof raw.Make === "string" ? raw.Make : undefined,
      model: typeof raw.Model === "string" ? raw.Model : undefined,
    };
  } catch {
    return {};
  }
}

/** Check whether exiftool is available in PATH. */
export async function exiftoolAvailable(): Promise<boolean> {
  try {
    await execFileAsync("exiftool", ["-ver"], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Pull the best date string from Immich asset metadata. */
function bestAssetDate(asset: ImmichAsset): string | undefined {
  const raw =
    (asset.localDateTime as string | undefined) ??
    (asset.fileCreatedAt as string | undefined);
  if (!raw) return undefined;
  // Normalise to YYYY-MM-DD
  return raw.slice(0, 10);
}

/** Collect text hints from an asset (filename, originalPath, any caption). */
function assetTextHints(asset: ImmichAsset): string {
  const parts: string[] = [];
  if (asset.originalFileName) parts.push(asset.originalFileName);
  if (typeof asset.originalPath === "string") parts.push(asset.originalPath);
  // Some versions expose description or exifInfo.ImageDescription
  if (typeof asset.description === "string") parts.push(asset.description);
  const exif = asset.exifInfo as Record<string, unknown> | null | undefined;
  if (exif) {
    if (typeof exif.description === "string") parts.push(exif.description);
    if (typeof exif.imageName === "string") parts.push(exif.imageName);
  }
  return parts.join(" ");
}

interface AssetScore {
  asset: ImmichAsset;
  eventId: string;
  score: number;
  reasons: string[];
}

function scoreAsset(asset: ImmichAsset, event: JewishLifecycleEventType): AssetScore {
  let score = 0;
  const reasons: string[] = [];

  // 1. Keyword match in filename/path/description
  const textHint = assetTextHints(asset);
  if (textHint) {
    const matches = findLifecycleMatches(textHint);
    if (matches.some((m) => m.id === event.id)) {
      score += 40;
      reasons.push("filename/caption keyword match");
    }
  }

  // 2. Date falls in holiday window (for holiday events)
  const dateStr = bestAssetDate(asset);
  if (dateStr) {
    const holidays = getHolidaysForDate(dateStr);
    if (holidays.includes(event.id)) {
      score += 35;
      reasons.push(`date ${dateStr} falls in ${event.label} window`);
    }
  }

  // 3. City/location hints (heuristic: city names associated with shuls, halls)
  // Lightweight — just boost if we already have score
  if (score > 0 && (asset.city || asset.country)) {
    score += 5;
    reasons.push("has geo metadata");
  }

  return { asset, eventId: event.id, score, reasons };
}

// ---------------------------------------------------------------------------
// Date clustering
// ---------------------------------------------------------------------------

interface DateCluster {
  dateStr: string;          // Representative date (YYYY-MM-DD)
  assetIds: string[];
  minDate: string;
  maxDate: string;
}

/** Group assets whose dates fall within `windowDays` of each other. */
function clusterByDate(assets: ImmichAsset[], windowDays = 3): DateCluster[] {
  // Sort by date
  const dated = assets
    .map((a) => ({ asset: a, date: bestAssetDate(a) }))
    .filter((x): x is { asset: ImmichAsset; date: string } => Boolean(x.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const clusters: DateCluster[] = [];
  let current: DateCluster | null = null;

  for (const { asset, date } of dated) {
    if (!current) {
      current = { dateStr: date, assetIds: [asset.id], minDate: date, maxDate: date };
    } else {
      const diffMs = new Date(date + "T12:00:00Z").getTime() -
        new Date(current.maxDate + "T12:00:00Z").getTime();
      const diffDays = diffMs / 86400000;
      if (diffDays <= windowDays) {
        current.assetIds.push(asset.id);
        current.maxDate = date;
      } else {
        clusters.push(current);
        current = { dateStr: date, assetIds: [asset.id], minDate: date, maxDate: date };
      }
    }
  }
  if (current) clusters.push(current);

  return clusters;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LifecycleSuggestion {
  eventId: string;
  eventLabel: string;
  confidence: "high" | "medium" | "low";
  reasoning: string[];
  suggestedAlbumName: string;
  assetIds: string[];
  dateRange: string;
  /** Ready-to-use args for label_event — user must still confirm */
  pendingAction: {
    tool: "label_event";
    args: {
      event_type: string;
      asset_ids: string[];
      confirm: false;
    };
  };
}

/** Analyse a list of Immich assets and return advisory lifecycle suggestions. */
export function analyzeAssets(
  assets: ImmichAsset[],
  options: {
    albumName?: string;     // Existing album name, if any
    albumDescription?: string;
  } = {}
): LifecycleSuggestion[] {
  if (assets.length === 0) return [];

  // Map each event → asset scores
  const eventHits = new Map<string, AssetScore[]>();

  for (const event of JEWISH_LIFECYCLE_TAXONOMY) {
    const hits: AssetScore[] = [];
    for (const asset of assets) {
      const s = scoreAsset(asset, event);
      if (s.score > 0) hits.push(s);
    }
    if (hits.length > 0) eventHits.set(event.id, hits);
  }

  // Also score the album name/description if provided
  if (options.albumName || options.albumDescription) {
    const albumText = [options.albumName, options.albumDescription].filter(Boolean).join(" ");
    const albumMatches = findLifecycleMatches(albumText);
    for (const match of albumMatches) {
      if (!eventHits.has(match.id)) {
        // Give every asset a small boost for this event based on album name
        const boost: AssetScore[] = assets.map((a) => ({
          asset: a,
          eventId: match.id,
          score: 20,
          reasons: [`album name "${options.albumName}" matches ${match.label}`]
        }));
        eventHits.set(match.id, boost);
      }
    }
  }

  // Build suggestions
  const suggestions: LifecycleSuggestion[] = [];

  for (const [eventId, hits] of eventHits) {
    const event = JEWISH_LIFECYCLE_TAXONOMY.find((e) => e.id === eventId);
    if (!event) continue;

    const uniqueAssets = [...new Map(hits.map((h) => [h.asset.id, h])).values()];
    const assetIds = uniqueAssets.map((h) => h.asset.id);
    const avgScore = uniqueAssets.reduce((s, h) => s + h.score, 0) / uniqueAssets.length;

    // Cluster the matching assets by date
    const clusters = clusterByDate(uniqueAssets.map((h) => h.asset));
    const dateRange = clusters.length > 0
      ? clusters[0].minDate + (clusters[0].maxDate !== clusters[0].minDate ? ` – ${clusters[0].maxDate}` : "")
      : "unknown date";

    // Infer year from date
    const repDate = uniqueAssets[0] ? bestAssetDate(uniqueAssets[0].asset) : undefined;
    const year = repDate ? repDate.slice(0, 4) : "";

    const confidence: "high" | "medium" | "low" =
      avgScore >= 60 ? "high" : avgScore >= 30 ? "medium" : "low";

    const allReasons = [...new Set(uniqueAssets.flatMap((h) => h.reasons))];

    const suggestedAlbumName = year
      ? `${event.label} — ${year}`
      : event.label;

    suggestions.push({
      eventId,
      eventLabel: event.label,
      confidence,
      reasoning: allReasons,
      suggestedAlbumName,
      assetIds,
      dateRange,
      pendingAction: {
        tool: "label_event",
        args: {
          event_type: eventId,
          asset_ids: assetIds,
          confirm: false
        }
      }
    });
  }

  // Sort: high confidence first, then by number of matching assets
  suggestions.sort((a, b) => {
    const cOrder = { high: 0, medium: 1, low: 2 };
    const cDiff = cOrder[a.confidence] - cOrder[b.confidence];
    if (cDiff !== 0) return cDiff;
    return b.assetIds.length - a.assetIds.length;
  });

  return suggestions;
}

export interface LabelEventPreview {
  proposed: {
    albumName: string;
    description: string;
    assetCount: number;
    assetIds: string[];
  };
  note: string;
}

/** Build a preview of what label_event would do (advisory, no writes). */
export function buildLabelEventPreview(input: {
  eventType: string;
  personName?: string;
  year?: string | number;
  assetIds: string[];
  customAlbumName?: string;
}): LabelEventPreview {
  const event = JEWISH_LIFECYCLE_TAXONOMY.find((e) => e.id === input.eventType);
  const baseLabel = event ? event.label : input.eventType;

  const parts: string[] = [baseLabel];
  if (input.personName) parts.push(input.personName);
  if (input.year) parts.push(String(input.year));

  const albumName = input.customAlbumName ?? parts.join(" — ");
  const description = event ? event.description : "";

  return {
    proposed: {
      albumName,
      description,
      assetCount: input.assetIds.length,
      assetIds: input.assetIds
    },
    note: "This is a preview. Call label_event with confirm=true to create the album."
  };
}
