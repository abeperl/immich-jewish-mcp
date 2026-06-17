#!/usr/bin/env node
/**
 * Immich Jewish MCP Server
 * BYO self-hosted Immich MCP tools for organizing family photos by Jewish lifecycle events.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { createAlbum, labelAlbum, listAlbums, listAssets, searchAssets } from "./immich-api.js";
import { findLifecycleMatches, JEWISH_LIFECYCLE_TAXONOMY } from "./data/jewish-lifecycle-taxonomy.js";
import {
  analyzeAssets,
  buildLabelEventPreview,
  extractExif,
  exiftoolAvailable,
} from "./semantic-lifecycle.js";

const TOOLS: Tool[] = [
  // ── Immich plumbing ──────────────────────────────────────────────────────
  {
    name: "search_assets",
    description:
      "Search Immich assets by text/date and optional Jewish lifecycle event type. " +
      "Requires IMMICH_BASE_URL and IMMICH_API_KEY from the user's MCP config.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Immich metadata/smart-search query, e.g. 'seder table' or 'tefillin'." },
        event_type: { type: "string", description: "Optional lifecycle taxonomy id, e.g. bar_mitzvah, bris, upsherin, pesach." },
        start_date: { type: "string", description: "Optional ISO date lower bound (YYYY-MM-DD)." },
        end_date: { type: "string", description: "Optional ISO date upper bound (YYYY-MM-DD)." },
        limit: { type: "number", description: "Maximum assets to return (1-100, default 25).", default: 25 }
      },
      required: []
    }
  },
  {
    name: "list_albums",
    description: "List albums in the user's Immich instance.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "list_assets",
    description: "List assets, optionally within an Immich album.",
    inputSchema: {
      type: "object",
      properties: {
        album_id: { type: "string", description: "Optional Immich album id." },
        limit: { type: "number", description: "Maximum assets to return (default 50).", default: 50 }
      },
      required: []
    }
  },
  {
    name: "create_album",
    description: "Create an Immich album, optionally seeded with asset ids.",
    inputSchema: {
      type: "object",
      properties: {
        album_name: { type: "string", description: "Album title, e.g. 'Levi Bar Mitzvah — 2026'." },
        description: { type: "string", description: "Optional album description/label." },
        asset_ids: { type: "array", items: { type: "string" }, description: "Optional Immich asset ids to add." }
      },
      required: ["album_name"]
    }
  },
  {
    name: "label_album",
    description: "Rename/describe an album and/or add assets, useful for lifecycle labels after review.",
    inputSchema: {
      type: "object",
      properties: {
        album_id: { type: "string", description: "Immich album id." },
        album_name: { type: "string", description: "Optional new album title." },
        description: { type: "string", description: "Optional description containing Jewish lifecycle tags/context." },
        add_asset_ids: { type: "array", items: { type: "string" }, description: "Optional asset ids to add." }
      },
      required: ["album_id"]
    }
  },
  // ── Semantic taxonomy helper ─────────────────────────────────────────────
  {
    name: "suggest_lifecycle_tags",
    description: "Suggest Jewish lifecycle event tags from free text, filenames, album names, captions, or user notes.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to classify." },
        include_taxonomy: { type: "boolean", description: "Return the full taxonomy along with matches.", default: false }
      },
      required: ["text"]
    }
  },
  // ── Semantic lifecycle layer (Task 3) ────────────────────────────────────
  {
    name: "suggest_lifecycle_albums",
    description:
      "Analyse a set of Immich assets and suggest Jewish lifecycle event album groupings. " +
      "Combines EXIF date signals, Jewish holiday calendar windows, and filename/album " +
      "keyword matching to produce advisory suggestions. Nothing is written until the user " +
      "confirms via label_event with confirm=true.",
    inputSchema: {
      type: "object",
      properties: {
        asset_ids: {
          type: "array",
          items: { type: "string" },
          description: "Specific Immich asset ids to analyse."
        },
        album_id: {
          type: "string",
          description: "Analyse all assets in this Immich album."
        },
        search_query: {
          type: "string",
          description: "Search Immich first and analyse the results."
        },
        event_type_filter: {
          type: "string",
          description: "Limit suggestions to a specific taxonomy event id (e.g. bar_mitzvah)."
        },
        limit: {
          type: "number",
          description: "Maximum assets to fetch when using album_id or search_query (default 100).",
          default: 100
        }
      },
      required: []
    }
  },
  {
    name: "label_event",
    description:
      "Label a set of Immich assets as a Jewish lifecycle event by creating (or previewing) " +
      "an Immich album. Set confirm=false (default) to preview what would be created without " +
      "writing anything. Set confirm=true only after reviewing the preview with the user.",
    inputSchema: {
      type: "object",
      properties: {
        event_type: {
          type: "string",
          description: "Taxonomy event id (e.g. bar_mitzvah, bris, pesach, wedding)."
        },
        asset_ids: {
          type: "array",
          items: { type: "string" },
          description: "Immich asset ids to include in the event album."
        },
        person_name: {
          type: "string",
          description: "Optional name of the person/family (e.g. 'Levi' for 'Bar Mitzvah — Levi — 2026')."
        },
        year: {
          type: "string",
          description: "Optional year to include in the album name."
        },
        custom_album_name: {
          type: "string",
          description: "Override the auto-generated album name entirely."
        },
        description: {
          type: "string",
          description: "Optional album description/notes."
        },
        confirm: {
          type: "boolean",
          description: "Set true to actually create the album. Default false (preview only).",
          default: false
        }
      },
      required: ["event_type", "asset_ids"]
    }
  },
  {
    name: "get_exif_info",
    description:
      "Extract EXIF metadata (date, GPS, camera) from a local photo file using exiftool. " +
      "Useful for photos not yet uploaded to Immich. Returns dateTime, lat/lon, city, country, camera make/model.",
    inputSchema: {
      type: "object",
      properties: {
        file_path: {
          type: "string",
          description: "Absolute path to a local image or video file."
        }
      },
      required: ["file_path"]
    }
  }
];

function jsonText(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function errorText(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const server = new Server(
  { name: "immich-jewish-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    // ── Plumbing tools ───────────────────────────────────────────────────
    case "search_assets": {
      const result = await searchAssets({
        query: typeof args?.query === "string" ? args.query : undefined,
        eventType: typeof args?.event_type === "string" ? args.event_type : undefined,
        startDate: typeof args?.start_date === "string" ? args.start_date : undefined,
        endDate: typeof args?.end_date === "string" ? args.end_date : undefined,
        limit: typeof args?.limit === "number" ? args.limit : undefined
      });
      return result.error ? errorText(result.error) : jsonText(result);
    }

    case "list_albums": {
      const result = await listAlbums();
      return result.error ? errorText(result.error) : jsonText(result);
    }

    case "list_assets": {
      const result = await listAssets({
        albumId: typeof args?.album_id === "string" ? args.album_id : undefined,
        limit: typeof args?.limit === "number" ? args.limit : undefined
      });
      return result.error ? errorText(result.error) : jsonText(result);
    }

    case "create_album": {
      const albumName = String(args?.album_name || "").trim();
      if (!albumName) return errorText("album_name is required");
      const result = await createAlbum({
        albumName,
        description: typeof args?.description === "string" ? args.description : undefined,
        assetIds: Array.isArray(args?.asset_ids) ? args.asset_ids.map(String) : undefined
      });
      return result.error ? errorText(result.error) : jsonText(result);
    }

    case "label_album": {
      const albumId = String(args?.album_id || "").trim();
      if (!albumId) return errorText("album_id is required");
      const result = await labelAlbum({
        albumId,
        albumName: typeof args?.album_name === "string" ? args.album_name : undefined,
        description: typeof args?.description === "string" ? args.description : undefined,
        addAssetIds: Array.isArray(args?.add_asset_ids) ? args.add_asset_ids.map(String) : undefined
      });
      return result.error ? errorText(result.error) : jsonText(result);
    }

    // ── Taxonomy helper ──────────────────────────────────────────────────
    case "suggest_lifecycle_tags": {
      const text = String(args?.text || "").trim();
      if (!text) return errorText("text is required");
      return jsonText({
        matches: findLifecycleMatches(text),
        taxonomy: Boolean(args?.include_taxonomy) ? JEWISH_LIFECYCLE_TAXONOMY : undefined
      });
    }

    // ── Semantic lifecycle layer ─────────────────────────────────────────
    case "suggest_lifecycle_albums": {
      const limit = typeof args?.limit === "number" ? Math.min(args.limit, 200) : 100;

      // 1. Collect assets from whichever source was given
      let assets: import("./immich-api.js").ImmichAsset[] = [];

      if (Array.isArray(args?.asset_ids) && args.asset_ids.length > 0) {
        // Use provided ids — fetch via list_assets for each, or search with no query
        // We use a search approach: fetch a broad set then filter by id
        const fetched = await listAssets({ limit: 200 });
        if (fetched.error) return errorText(fetched.error);
        const idSet = new Set(args.asset_ids.map(String));
        assets = fetched.assets.filter((a) => idSet.has(a.id));
        // If we didn't get them all from the global list, note it
        if (assets.length < idSet.size) {
          // Try album fetch for any album_id given
          if (typeof args?.album_id === "string") {
            const albumFetch = await listAssets({ albumId: args.album_id, limit });
            if (!albumFetch.error) {
              for (const a of albumFetch.assets) {
                if (idSet.has(a.id) && !assets.find((x) => x.id === a.id)) assets.push(a);
              }
            }
          }
        }
      } else if (typeof args?.album_id === "string") {
        const fetched = await listAssets({ albumId: args.album_id, limit });
        if (fetched.error) return errorText(fetched.error);
        assets = fetched.assets;
      } else if (typeof args?.search_query === "string") {
        const fetched = await searchAssets({ query: args.search_query, limit });
        if (fetched.error) return errorText(fetched.error);
        assets = fetched.assets;
      } else {
        // No filter — fetch recent assets
        const fetched = await listAssets({ limit });
        if (fetched.error) return errorText(fetched.error);
        assets = fetched.assets;
      }

      if (assets.length === 0) {
        return jsonText({ suggestions: [], note: "No assets found to analyse." });
      }

      // 2. Run semantic analysis
      const albumName = typeof args?.album_id === "string" ? undefined : undefined; // could pass album name from metadata
      let suggestions = analyzeAssets(assets, { albumName });

      // 3. Filter by event_type if requested
      if (typeof args?.event_type_filter === "string" && args.event_type_filter) {
        suggestions = suggestions.filter((s) => s.eventId === args.event_type_filter);
      }

      return jsonText({
        analysedAssetCount: assets.length,
        suggestions,
        note: "These are advisory suggestions only. Use label_event with confirm=true to create an album after review."
      });
    }

    case "label_event": {
      const eventType = String(args?.event_type || "").trim();
      if (!eventType) return errorText("event_type is required");

      const assetIds = Array.isArray(args?.asset_ids) ? args.asset_ids.map(String) : [];
      if (assetIds.length === 0) return errorText("asset_ids must be a non-empty array");

      const personName = typeof args?.person_name === "string" ? args.person_name.trim() : undefined;
      const year = args?.year != null ? String(args.year).trim() : undefined;
      const customAlbumName = typeof args?.custom_album_name === "string" ? args.custom_album_name.trim() : undefined;
      const description = typeof args?.description === "string" ? args.description.trim() : undefined;
      const confirm = Boolean(args?.confirm);

      // Build preview
      const preview = buildLabelEventPreview({ eventType, personName, year, assetIds, customAlbumName });

      if (!confirm) {
        return jsonText({
          mode: "preview",
          ...preview,
          instruction: "Review the proposal above, then call label_event again with confirm=true to create the album."
        });
      }

      // Actually create the album
      const result = await createAlbum({
        albumName: preview.proposed.albumName,
        description: description ?? preview.proposed.description,
        assetIds
      });
      if (result.error) return errorText(result.error);

      return jsonText({
        mode: "created",
        album: result.album,
        assetCount: assetIds.length,
        message: `Album "${preview.proposed.albumName}" created with ${assetIds.length} assets.`
      });
    }

    case "get_exif_info": {
      const filePath = String(args?.file_path || "").trim();
      if (!filePath) return errorText("file_path is required");

      const available = await exiftoolAvailable();
      if (!available) {
        return errorText(
          "exiftool is not installed or not in PATH. " +
          "Install with: brew install exiftool  (macOS/linuxbrew) or: sudo apt install libimage-exiftool-perl  (Debian/Ubuntu)"
        );
      }

      const exif = await extractExif(filePath);
      return jsonText({ filePath, exif });
    }

    default:
      return errorText(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
