const JSON_HEADERS = { "content-type": "application/json" };

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function readJson(response, service) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${service} returned HTTP ${response.status}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${service} returned an invalid JSON response`);
  }
}

function parseMcpEventStream(text) {
  const dataLine = text
    .split(/\r?\n/)
    .find((line) => line.startsWith("data:"));
  if (!dataLine) throw new Error("GIS MCP returned an unexpected response");
  return JSON.parse(dataLine.slice(5).trim());
}

async function callHazardsAtLocation(location) {
  const response = await fetch(requireEnv("GLENDALE_GIS_MCP_URL"), {
    method: "POST",
    headers: {
      ...JSON_HEADERS,
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${requireEnv("GLENDALE_GIS_MCP_SECRET")}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: {
        name: "hazards_at_location",
        arguments: { location },
      },
    }),
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`GIS MCP returned HTTP ${response.status}`);
  const event = parseMcpEventStream(text);
  if (event.error) throw new Error(event.error.message ?? "GIS MCP request failed");
  if (event.result?.isError) {
    throw new Error(event.result.content?.[0]?.text ?? "GIS lookup failed");
  }
  const structured = event.result?.structuredContent;
  if (!structured) throw new Error("GIS MCP did not return structured hazard data");
  return structured;
}

function sourceFor(item) {
  return item?._meta
    ? {
        name: item._meta.source,
        url: item._meta.url,
        asOf: item._meta.as_of,
        sourceLastEdit: item._meta.source_last_edit ?? null,
      }
    : null;
}

function zoneLabel(item, preferredFields) {
  const attributes = item?.matches?.[0]?.attributes ?? {};
  for (const field of preferredFields) {
    if (attributes[field] !== undefined && attributes[field] !== null) {
      return String(attributes[field]);
    }
  }
  return null;
}

function intersectionLabel(item, inZone, outOfZone) {
  if (!item || item.status === "unavailable") return "Data unavailable";
  return item.status === "in_zone" ? inZone : outOfZone;
}

export function normalizeHazards(data) {
  const wildfireClass = zoneLabel(data.wildfire, ["FHSZ_Description", "FHSZ"]);
  const floodZone = zoneLabel(data.flood, ["FLD_ZONE"]);
  const floodSubtype = zoneLabel(data.flood, ["ZONE_SUBTY"]);

  return {
    location: data.location,
    categories: {
      wildfire: {
        status: data.wildfire?.status ?? "unavailable",
        label:
          data.wildfire?.status === "in_zone"
            ? `${wildfireClass ?? "Mapped"} fire hazard severity zone`
            : intersectionLabel(
                data.wildfire,
                "Mapped zone intersection found",
                "No mapped zone intersection found",
              ),
        detail:
          "CAL FIRE zones describe long-term landscape hazard, not building-specific risk or current fire conditions.",
        disclaimer: data.wildfire?.disclaimer,
        source: sourceFor(data.wildfire),
      },
      flood: {
        status: data.flood?.status ?? "unavailable",
        label:
          data.flood?.status === "in_zone"
            ? `FEMA Zone ${floodZone ?? "mapped"}${floodSubtype ? ` — ${floodSubtype.toLowerCase()}` : ""}`
            : intersectionLabel(
                data.flood,
                "Mapped zone intersection found",
                "No mapped zone intersection found",
              ),
        detail:
          data.flood?.matches?.[0]?.attributes?.SFHA_TF === "T"
            ? "This location intersects a FEMA Special Flood Hazard Area mapping."
            : "This location is not marked as a Special Flood Hazard Area in the returned FEMA feature.",
        disclaimer: data.flood?.disclaimer,
        source: sourceFor(data.flood),
      },
      seismic: {
        status:
          [data.fault, data.liquefaction, data.landslide].some(
            (item) => item?.status === "in_zone",
          )
            ? "in_zone"
            : "not_in_zone",
        label: [
          intersectionLabel(
            data.fault,
            "Fault-rupture zone intersection",
            "No fault-rupture zone intersection",
          ),
          intersectionLabel(
            data.liquefaction,
            "Liquefaction zone intersection",
            "No liquefaction-zone intersection",
          ),
          intersectionLabel(
            data.landslide,
            "Earthquake-induced landslide zone intersection",
            "No earthquake-induced landslide-zone intersection",
          ),
        ].join(" · "),
        detail:
          "Mapped seismic zones are planning information, not a site-specific engineering assessment; all of Glendale can experience shaking.",
        disclaimer: data.liquefaction?.disclaimer ?? data.fault?.disclaimer,
        sources: [data.fault, data.liquefaction, data.landslide]
          .map(sourceFor)
          .filter(Boolean),
      },
    },
  };
}

export async function getConversationToken() {
  const apiKey = requireEnv("ELEVENLABS_API_KEY");
  const agentId = requireEnv("NEXT_PUBLIC_ELEVENLABS_AGENT_ID");
  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/token");
  url.searchParams.set("agent_id", agentId);

  const response = await fetch(url, { headers: { "xi-api-key": apiKey } });
  const body = await readJson(response, "ElevenLabs");
  if (!body.token) throw new Error("ElevenLabs response did not include a token");
  return { token: body.token };
}

export async function getMappedHazards(address) {
  if (typeof address !== "string" || address.trim().length < 5) {
    throw new Error("A valid Glendale property address is required");
  }

  return normalizeHazards(await callHazardsAtLocation({ address: address.trim() }));
}

export async function getMappedHazardsByCoordinates(lat, lon) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error("A valid latitude is required");
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error("A valid longitude is required");
  }
  return callHazardsAtLocation({ lat, lon });
}

const GIS_HOSTS = new Set([
  "hazards.fema.gov",
  "services.arcgis.com",
  "services1.arcgis.com",
  "services2.arcgis.com",
]);

export async function getFeatureGeometry(layerUrl, objectId) {
  const parsedUrl = new URL(layerUrl);
  if (parsedUrl.protocol !== "https:" || !GIS_HOSTS.has(parsedUrl.hostname)) {
    throw new Error("Unsupported GIS layer host");
  }
  if (!Number.isInteger(objectId) || objectId < 0) {
    throw new Error("A valid GIS object ID is required");
  }

  parsedUrl.pathname = `${parsedUrl.pathname.replace(/\/$/, "")}/query`;
  parsedUrl.search = new URLSearchParams({
    where: `OBJECTID=${objectId}`,
    outFields: "*",
    returnGeometry: "true",
    f: "geojson",
  }).toString();

  const response = await fetch(parsedUrl);
  return readJson(response, "GIS feature service");
}
