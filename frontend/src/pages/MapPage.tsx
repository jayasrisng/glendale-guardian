import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
} from "react-leaflet";

import BottomNav from "../components/BottomNav";
import { getHazardStyle } from "../styles/hazardStyles";

type ResourceMarker = {
  kind: string;
  name: string;
  address: string | null;
  distance: number;
  position: [number, number];
};

type Advice = {
  summary: string;
  tips: string[];
  note: string;
};

type Season = "spring" | "summer" | "fall" | "winter";

type HazardLayer = {
  type: string;
  title: string;
  status: string;
  distance: number;
  geometry: any;
};

const hazardTypes = [
  "wildfire",
  "flood",
  "fault",
  "liquefaction",
  "landslide",
  "dam_inundation",
  "debris_flow",
];

const hazardLabels: Record<string, string> = {
  wildfire: "Wildfire",
  flood: "Flood",
  fault: "Fault Zone",
  liquefaction: "Liquefaction",
  landslide: "Landslide",
  dam_inundation: "Dam Inundation",
  debris_flow: "Debris Flow",
};

const seasonalHazards: Record<Season, string[]> = {
  spring: ["flood", "landslide", "debris_flow"],
  summer: ["wildfire"],
  fall: ["wildfire", "debris_flow"],
  winter: ["flood", "landslide", "debris_flow", "dam_inundation"],
};

const resourceKinds = ["fire_stations", "police_stations", "hospitals"];

const resourceLabels: Record<string, string> = {
  fire_stations: "Fire",
  police_stations: "Police",
  hospitals: "Hospitals",
};

const resourceColors: Record<string, string> = {
  fire_stations: "#dc2626",
  police_stations: "#2563eb",
  hospitals: "#16a34a",
};

function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1;

  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

function getHazardDistance(hazard: any): number {
  if (hazard.status === "in_zone" && hazard.matches?.length > 0) {
    return 0;
  }

  if (hazard.nearest?.distance_m != null) {
    return hazard.nearest.distance_m;
  }

  if (hazard.nearest_by_class) {
    const distances = Object.values(hazard.nearest_by_class)
      .map((item: any) => item?.distance_m)
      .filter(
        (distance): distance is number => typeof distance === "number"
      );

    if (distances.length > 0) {
      return Math.min(...distances);
    }
  }

  return Infinity;
}

function getHazardFeatureRef(hazard: any) {
  if (hazard.status === "in_zone" && hazard.matches?.length > 0) {
    return hazard.matches[0].ref;
  }

  if (hazard.nearest?.ref) {
    return hazard.nearest.ref;
  }

  if (hazard.nearest_by_class) {
    const candidates = Object.values(hazard.nearest_by_class) as any[];

    const closest = candidates
      .filter(
        (item) => item?.ref && typeof item?.distance_m === "number"
      )
      .sort((a, b) => a.distance_m - b.distance_m)[0];

    return closest?.ref ?? null;
  }

  return null;
}

function MapPage() {
  const [resourceMarkers, setResourceMarkers] = useState<ResourceMarker[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  const [location, setLocation] = useState<[number, number] | null>(null);
  const [error, setError] = useState("");
  const [loadingHazards, setLoadingHazards] = useState(false);
  const [season, setSeason] = useState<Season>(getCurrentSeason());
  const [hazardLayers, setHazardLayers] = useState<HazardLayer[]>([]);

  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  const [visibleHazards, setVisibleHazards] = useState<Record<string, boolean>>({
    wildfire: false,
    flood: false,
    fault: false,
    liquefaction: false,
    landslide: false,
    dam_inundation: false,
    debris_flow: false,
  });

  const [visibleResources, setVisibleResources] = useState<
    Record<string, boolean>
  >({
    fire_stations: true,
    police_stations: true,
    hospitals: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation([
          position.coords.latitude,
          position.coords.longitude,
        ]);
      },
      (err) => {
        console.error("Location error:", err);
        setError("Unable to get your location.");
      }
    );
  }, []);

  useEffect(() => {
    if (!location) return;

    const [lat, lon] = location;
    let cancelled = false;

    setResourceMarkers([]);

    async function loadResources() {
      try {
        setLoadingResources(true);

        const response = await fetch(
          `http://127.0.0.1:8000/resources?lat=${lat}&lon=${lon}&limit=2`
        );

        if (!response.ok) {
          throw new Error("Unable to load resources.");
        }

        const data = await response.json();

        const requests = (data.groups ?? [])
          .filter((group: any) => resourceKinds.includes(group.kind))
          .flatMap((group: any) =>
            (group.results ?? []).map(async (resource: any) => {
              const ref = resource.ref;
              if (!ref) return;

              try {
                const geometryResponse = await fetch(
                  `http://127.0.0.1:8000/feature-geometry?layer_url=${encodeURIComponent(
                    ref.layer_url
                  )}&object_id=${ref.object_id}`
                );

                if (!geometryResponse.ok) return;

                const geometry = await geometryResponse.json();
                const feature = geometry.features?.[0];

                if (!feature || feature.geometry?.type !== "Point") return;

                const [longitude, latitude] = feature.geometry.coordinates;
                const marker: ResourceMarker = {
                  kind: group.kind,
                  name: resource.name ?? group.title,
                  address: resource.address ?? null,
                  distance: resource.distance_m,
                  position: [latitude, longitude],
                };

                if (!cancelled) {
                  setResourceMarkers((previous) => {
                    const duplicate = previous.some(
                      (item) =>
                        item.kind === marker.kind &&
                        item.name === marker.name &&
                        item.position[0] === marker.position[0] &&
                        item.position[1] === marker.position[1]
                    );
                    return duplicate ? previous : [...previous, marker];
                  });
                }
              } catch (resourceError) {
                console.error("Resource geometry error:", resourceError);
              }
            })
          );

        await Promise.allSettled(requests);
      } catch (resourceError) {
        console.error("Resource loading error:", resourceError);
      } finally {
        if (!cancelled) {
          setLoadingResources(false);
        }
      }
    }

    loadResources();

    return () => {
      cancelled = true;
    };
  }, [location]);

  useEffect(() => {
    if (!location) return;

    const [lat, lon] = location;
    let cancelled = false;

    async function loadHazards() {
      try {
        setLoadingHazards(true);

        const response = await fetch(
          `http://127.0.0.1:8000/hazards?lat=${lat}&lon=${lon}`
        );

        if (!response.ok) {
          throw new Error("Unable to load hazard data.");
        }

        const data = await response.json();

        async function loadOneHazard(type: string) {
          const hazard = data[type];
          if (!hazard) return;

          const featureRef = getHazardFeatureRef(hazard);
          if (!featureRef) return;

          try {
            const geometryResponse = await fetch(
              `http://127.0.0.1:8000/feature-geometry?layer_url=${encodeURIComponent(
                featureRef.layer_url
              )}&object_id=${featureRef.object_id}`
            );

            if (!geometryResponse.ok) return;

            const geometry = await geometryResponse.json();
            if (!geometry?.features?.length) return;

            const layer: HazardLayer = {
              type,
              title: hazard.title ?? hazardLabels[type],
              status: hazard.status ?? "unknown",
              distance: getHazardDistance(hazard),
              geometry,
            };

            if (!cancelled) {
              setHazardLayers((previous) => {
                const withoutOld = previous.filter((item) => item.type !== type);
                return [...withoutOld, layer];
              });
            }
          } catch (geometryError) {
            console.error(`Failed to load ${type}:`, geometryError);
          }
        }

        const seasonCandidates = seasonalHazards[season]
          .map((type) => ({
            type,
            hazard: data[type],
            distance: data[type] ? getHazardDistance(data[type]) : Infinity,
          }))
          .filter((item) => item.hazard && Number.isFinite(item.distance))
          .sort((a, b) => a.distance - b.distance);

        const firstType = seasonCandidates[0]?.type ?? null;

        // Make one useful layer visible first instead of waiting on every GIS request.
        if (firstType) {
          await loadOneHazard(firstType);
        }

        const remainingTypes = hazardTypes.filter((type) => type !== firstType);
        await Promise.allSettled(remainingTypes.map(loadOneHazard));
      } catch (loadError) {
        console.error("Hazard loading error:", loadError);
      } finally {
        if (!cancelled) {
          setLoadingHazards(false);
        }
      }
    }

    loadHazards();

    return () => {
      cancelled = true;
    };
  }, [location, season]);

  const primaryHazard = useMemo(() => {
    const relevantTypes = seasonalHazards[season];

    const candidates = hazardLayers
      .filter((hazard) => relevantTypes.includes(hazard.type))
      .filter((hazard) => Number.isFinite(hazard.distance))
      .sort((a, b) => a.distance - b.distance);

    return candidates[0] ?? null;
  }, [hazardLayers, season]);

  useEffect(() => {
    if (!primaryHazard) return;

    setVisibleHazards((previous) => ({
      ...previous,
      [primaryHazard.type]: true,
    }));
  }, [primaryHazard]);

  function toggleHazard(type: string) {
    setVisibleHazards((previous) => ({
      ...previous,
      [type]: !previous[type],
    }));
  }

  function toggleResource(kind: string) {
    setVisibleResources((previous) => ({
      ...previous,
      [kind]: !previous[kind],
    }));
  }

  async function generateAdvice(hazard: HazardLayer, feature: any) {
    try {
      setLoadingAdvice(true);
      setAdvice(null);

      const response = await fetch("http://127.0.0.1:8000/ai/advice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hazard: hazard.type,
          title: hazard.title,
          status: hazard.status,
          distance: hazard.distance,
          season,
          properties: feature.properties ?? {},
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to generate advice");
      }

      const data = await response.json();
      setAdvice(data);
    } catch (adviceError) {
      console.error("Advice error:", adviceError);

      setAdvice({
        summary: "Safety guidance is temporarily unavailable.",
        tips: [
          "Monitor official emergency information.",
          "Keep emergency supplies available.",
          "Know your local evacuation routes and resources.",
        ],
        note: "Mapped hazard data is not a real-time emergency warning.",
      });
    } finally {
      setLoadingAdvice(false);
    }
  }

  if (error) {
    return (
      <main className="app-screen">
        <div className="map-status-card">
          <h1>My Area</h1>
          <p>{error}</p>
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!location) {
    return (
      <main className="app-screen">
        <div className="map-status-card">
          <h1>My Area</h1>
          <p>Getting your location...</p>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="app-screen map-page">
      <section className="map-controls">
        <div className="map-title-row">
          <div>
            <p className="eyebrow">Glendale Guardian</p>
            <h1>My Area</h1>
          </div>

          {(loadingHazards || loadingResources) && (
            <span className="loading-pill">Updating map…</span>
          )}
        </div>

        <label className="control-label" htmlFor="season">
          Seasonal hazard view
        </label>

        <select
          id="season"
          value={season}
          onChange={(event) => setSeason(event.target.value as Season)}
          className="season-select"
        >
          <option value="spring">Spring</option>
          <option value="summer">Summer</option>
          <option value="fall">Fall</option>
          <option value="winter">Winter</option>
        </select>

        {primaryHazard && (
          <div className="primary-hazard-card">
            <div>
              <p className="primary-hazard-label">Closest seasonal hazard</p>
              <strong>{hazardLabels[primaryHazard.type]}</strong>
            </div>

            <span
              className={`status-badge ${
                primaryHazard.distance === 0 ? "status-in-zone" : "status-nearby"
              }`}
            >
              {primaryHazard.distance === 0
                ? "In mapped area"
                : `${Math.round(primaryHazard.distance)} m away`}
            </span>
          </div>
        )}

        <div className="layer-section">
          <div className="section-heading-row">
            <span className="section-heading">Hazard layers</span>
            <span className="section-helper">Tap a shape for AI advice</span>
          </div>

          <div className="chip-row">
            {hazardTypes.map((type) => {
              const styles = getHazardStyle(type);
              const active = visibleHazards[type];
              const loaded = hazardLayers.some((hazard) => hazard.type === type);

              return (
                <button
                  key={type}
                  type="button"
                  disabled={!loaded}
                  onClick={() => toggleHazard(type)}
                  className={`filter-chip ${active ? "filter-chip-active" : ""}`}
                  style={
                    active
                      ? {
                          background: styles.fillColor,
                          borderColor: styles.color,
                          color: "white",
                        }
                      : undefined
                  }
                >
                  {active ? "✓ " : ""}
                  {hazardLabels[type]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="layer-section resource-section">
          <div className="section-heading-row">
            <span className="section-heading">Nearby resources</span>
            <span className="section-helper">Markers stay above hazard zones</span>
          </div>

          <div className="chip-row">
            {resourceKinds.map((kind) => {
              const active = visibleResources[kind];
              const color = resourceColors[kind];
              const count = resourceMarkers.filter(
                (resource) => resource.kind === kind
              ).length;

              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => toggleResource(kind)}
                  className={`filter-chip resource-chip ${
                    active ? "filter-chip-active" : ""
                  }`}
                  style={
                    active
                      ? {
                          background: color,
                          borderColor: color,
                          color: "white",
                        }
                      : undefined
                  }
                >
                  <span
                    className="resource-dot"
                    style={{ background: active ? "white" : color }}
                  />
                  {resourceLabels[kind]}
                  {count > 0 && <span className="chip-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="map-shell">
        <div className="map-legend" aria-hidden="true">
          <span><i style={{ background: resourceColors.fire_stations }} />Fire</span>
          <span><i style={{ background: resourceColors.police_stations }} />Police</span>
          <span><i style={{ background: resourceColors.hospitals }} />Hospital</span>
        </div>

        <MapContainer center={location} zoom={11} className="guardian-map">
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker position={location}>
            <Popup>You are here</Popup>
          </Marker>

          <Pane name="hazardPane" style={{ zIndex: 400 }}>
            {hazardLayers
              .filter((hazard) => visibleHazards[hazard.type])
              .map((hazard) => {
                const styles = getHazardStyle(hazard.type);
                const isPrimary = hazard.type === primaryHazard?.type;

                return (
                  <GeoJSON
                    key={`${hazard.type}-${season}`}
                    data={hazard.geometry}
                    pane="hazardPane"
                    style={{
                      color: styles.color,
                      fillColor: styles.fillColor,
                      weight: isPrimary ? 3 : 2,
                      opacity: 0.9,
                      fillOpacity: isPrimary ? 0.27 : 0.12,
                    }}
                    onEachFeature={(feature, layer) => {
                      layer.on("click", () => {
                        setSelectedHazard({
                          type: hazard.type,
                          title: hazard.title,
                          status: hazard.status,
                          distance: hazard.distance,
                          properties: feature.properties,
                        });

                        generateAdvice(hazard, feature);
                      });
                    }}
                  />
                );
              })}
          </Pane>

          <Pane name="resourcePane" style={{ zIndex: 650 }}>
            {resourceMarkers
              .filter((resource) => visibleResources[resource.kind])
              .map((resource, index) => (
                <CircleMarker
                  key={`${resource.kind}-${resource.name}-${index}`}
                  center={resource.position}
                  pane="resourcePane"
                  radius={10}
                  bubblingMouseEvents={false}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 3,
                    fillColor: resourceColors[resource.kind] ?? "#475569",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <div className="resource-popup">
                      <span
                        className="resource-popup-type"
                        style={{ color: resourceColors[resource.kind] }}
                      >
                        {resourceLabels[resource.kind] ?? "Resource"}
                      </span>
                      <strong>{resource.name}</strong>
                      {resource.address && <span>{resource.address}</span>}
                      <span className="resource-popup-distance">
                        About {Math.round(resource.distance)} meters away
                      </span>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
          </Pane>
        </MapContainer>
      </section>

      {selectedHazard && (
        <div className="advice-backdrop" onClick={() => {
          setSelectedHazard(null);
          setAdvice(null);
        }}>
          <aside
            className="advice-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />

            <button
              type="button"
              className="sheet-close"
              aria-label="Close safety guidance"
              onClick={() => {
                setSelectedHazard(null);
                setAdvice(null);
              }}
            >
              ×
            </button>

            <div className="advice-title-row">
              <div>
                <p className="eyebrow">Mapped hazard</p>
                <h2>{selectedHazard.title}</h2>
              </div>
              <span
                className={`status-badge ${
                  selectedHazard.distance === 0 ? "status-in-zone" : "status-nearby"
                }`}
              >
                {selectedHazard.distance === 0
                  ? "In mapped area"
                  : `${Math.round(selectedHazard.distance)} m away`}
              </span>
            </div>

            {loadingAdvice && (
              <div className="advice-loading">
                <span className="loading-dot" />
                Generating safety guidance…
              </div>
            )}

            {advice && (
              <div className="advice-content">
                <h3>AI safety guidance</h3>
                <p>{advice.summary}</p>

                {advice.tips?.length > 0 && (
                  <ul>
                    {advice.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                )}

                {advice.note && <p className="advice-note">{advice.note}</p>}
              </div>
            )}
          </aside>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

export default MapPage;
