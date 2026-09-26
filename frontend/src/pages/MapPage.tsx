import { useEffect, useMemo, useState } from "react";

import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import BottomNav from "../components/BottomNav";
import { getHazardStyle } from "../styles/hazardStyles";

type Season = "spring" | "summer" | "fall" | "winter";

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

type HazardLayer = {
  type: string;
  title: string;
  status: string;
  distance: number;
  geometry: any;
};

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "/api";

const defaultPropertyLocation: [number, number] = [
  34.184034,
  -118.2294045,
];

function loadSelectedProperty() {
  try {
    const saved = JSON.parse(
      localStorage.getItem("glendale-guardian-assessment-v2") ?? "{}"
    );
    const lat = saved.hazards?.location?.lat;
    const lon = saved.hazards?.location?.lon;
    return {
      location:
        Number.isFinite(lat) && Number.isFinite(lon)
          ? ([lat, lon] as [number, number])
          : defaultPropertyLocation,
      address:
        saved.resident?.address ||
        "2527 Canada Blvd, Glendale, CA 91208",
    };
  } catch {
    return {
      location: defaultPropertyLocation,
      address: "2527 Canada Blvd, Glendale, CA 91208",
    };
  }
}

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

const resourceKinds = [
  "fire_stations",
  "police_stations",
  "hospitals",
];

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

/*
  Cache geometry requests for the lifetime of the page.
  This prevents duplicate ArcGIS geometry requests if the component remounts.
*/
const geometryCache = new Map<string, Promise<any>>();

async function fetchGeometry(
  layerUrl: string,
  objectId: number
) {
  const key = `${layerUrl}:${objectId}`;

  if (!geometryCache.has(key)) {
    geometryCache.set(
      key,
      fetch(
        `${API_BASE}/feature-geometry?layer_url=${encodeURIComponent(
          layerUrl
        )}&object_id=${objectId}`
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Geometry request failed (${response.status})`
          );
        }

        return response.json();
      })
    );
  }

  return geometryCache.get(key)!;
}

function RecenterMap({
  position,
}: {
  position: [number, number];
}) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [map, position]);

  return null;
}

function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1;

  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";

  return "winter";
}

function getHazardDistance(hazard: any): number {
  if (
    hazard.dataset === "fema_flood_zones" &&
    hazard.matches?.[0]?.attributes?.SFHA_TF !== "T"
  ) {
    const distances = Object.values(hazard.nearest_by_class ?? {})
      .filter((item: any) => item?.attributes?.SFHA_TF === "T")
      .map((item: any) => item.distance_m)
      .filter((distance): distance is number => typeof distance === "number");
    if (distances.length) return Math.min(...distances);
  }
  if (
    hazard.status === "in_zone" &&
    hazard.matches?.length > 0
  ) {
    return 0;
  }

  if (hazard.nearest?.distance_m != null) {
    return hazard.nearest.distance_m;
  }

  if (hazard.nearest_by_class) {
    const distances = Object.values(
      hazard.nearest_by_class
    )
      .map((item: any) => item?.distance_m)
      .filter(
        (distance): distance is number =>
          typeof distance === "number"
      );

    if (distances.length > 0) {
      return Math.min(...distances);
    }
  }

  return Infinity;
}

function getHazardFeatureRef(hazard: any) {
  if (
    hazard.dataset === "fema_flood_zones" &&
    hazard.matches?.[0]?.attributes?.SFHA_TF !== "T"
  ) {
    const nearestSpecialFlood = Object.values(hazard.nearest_by_class ?? {})
      .filter(
        (item: any) =>
          item?.ref &&
          item?.attributes?.SFHA_TF === "T" &&
          typeof item.distance_m === "number"
      )
      .sort((a: any, b: any) => a.distance_m - b.distance_m)[0] as any;
    if (nearestSpecialFlood?.ref) return nearestSpecialFlood.ref;
  }
  if (
    hazard.status === "in_zone" &&
    hazard.matches?.length > 0
  ) {
    return hazard.matches[0].ref;
  }

  if (hazard.nearest?.ref) {
    return hazard.nearest.ref;
  }

  if (hazard.nearest_by_class) {
    const candidates = Object.values(
      hazard.nearest_by_class
    ) as any[];

    const closest = candidates
      .filter(
        (item) =>
          item?.ref &&
          typeof item?.distance_m === "number"
      )
      .sort(
        (a, b) =>
          a.distance_m - b.distance_m
      )[0];

    return closest?.ref ?? null;
  }

  return null;
}

function MapPage() {
  const selectedProperty = useMemo(() => loadSelectedProperty(), []);
  const [location, setLocation] =
    useState<[number, number]>(
      selectedProperty.location
    );

  const [locationSource, setLocationSource] =
    useState<"property" | "device">("property");

  const [season, setSeason] =
    useState<Season>(getCurrentSeason());

  const [hazardLayers, setHazardLayers] =
    useState<HazardLayer[]>([]);

  const [resourceMarkers, setResourceMarkers] =
    useState<ResourceMarker[]>([]);

  const [loadingHazards, setLoadingHazards] =
    useState(false);

  const [loadingResources, setLoadingResources] =
    useState(false);

  const [selectedHazard, setSelectedHazard] =
    useState<any>(null);

  const [advice, setAdvice] =
    useState<Advice | null>(null);

  const [loadingAdvice, setLoadingAdvice] =
    useState(false);

  const [visibleHazards, setVisibleHazards] =
    useState<Record<string, boolean>>({
      wildfire: false,
      flood: false,
      fault: false,
      liquefaction: false,
      landslide: false,
      dam_inundation: false,
      debris_flow: false,
    });

  const [
    visibleResources,
    setVisibleResources,
  ] = useState<Record<string, boolean>>({
    fire_stations: true,
    police_stations: true,
    hospitals: true,
  });

  function useCurrentLocation() {
    navigator.geolocation?.getCurrentPosition((position) => {
      setLocation([
        position.coords.latitude,
        position.coords.longitude,
      ]);
      setLocationSource("device");
    });
  }

  /*
    Load resources whenever the active location changes.
    Geometry requests happen in parallel and markers are added progressively.
  */
  useEffect(() => {
    const [lat, lon] = location;
    let cancelled = false;

    async function loadResources() {
      try {
        setLoadingResources(true);

        const response = await fetch(
          `${API_BASE}/resources?lat=${lat}&lon=${lon}&limit=2`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load resources."
          );
        }

        const data = await response.json();

        const requests = (data.groups ?? [])
          .filter((group: any) =>
            resourceKinds.includes(group.kind)
          )
          .flatMap((group: any) =>
            (group.results ?? []).map(
              async (resource: any) => {
                const ref = resource.ref;
                if (!ref) return;

                try {
                  const geometry =
                    await fetchGeometry(
                      ref.layer_url,
                      ref.object_id
                    );

                  const feature =
                    geometry.features?.[0];

                  if (
                    !feature ||
                    feature.geometry?.type !==
                      "Point"
                  ) {
                    return;
                  }

                  const [
                    longitude,
                    latitude,
                  ] =
                    feature.geometry
                      .coordinates;

                  const marker: ResourceMarker =
                    {
                      kind: group.kind,
                      name:
                        resource.name ??
                        group.title,
                      address:
                        resource.address ??
                        null,
                      distance:
                        resource.distance_m,
                      position: [
                        latitude,
                        longitude,
                      ],
                    };

                  if (!cancelled) {
                    setResourceMarkers(
                      (previous) => {
                        const duplicate =
                          previous.some(
                            (item) =>
                              item.kind ===
                                marker.kind &&
                              item.name ===
                                marker.name &&
                              item.position[0] ===
                                marker
                                  .position[0] &&
                              item.position[1] ===
                                marker
                                  .position[1]
                          );

                        return duplicate
                          ? previous
                          : [
                              ...previous,
                              marker,
                            ];
                      }
                    );
                  }
                } catch (
                  resourceError
                ) {
                  console.error(
                    "Resource geometry error:",
                    resourceError
                  );
                }
              }
            )
          );

        await Promise.allSettled(
          requests
        );
      } catch (resourceError) {
        console.error(
          "Resource loading error:",
          resourceError
        );
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

  /*
    Load GIS hazard data only when location changes.
    Season changes only change which already-loaded layer is emphasized.
  */
  useEffect(() => {
    const [lat, lon] = location;
    let cancelled = false;

    async function loadHazards() {
      try {
        setLoadingHazards(true);

        const response = await fetch(
          `${API_BASE}/hazards?lat=${lat}&lon=${lon}`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load hazard data."
          );
        }

        const data = await response.json();

        const loadOneHazard =
          async (type: string) => {
            const hazard = data[type];

            if (!hazard) {
              return;
            }

            const featureRef =
              getHazardFeatureRef(hazard);

            if (!featureRef) {
              return;
            }

            try {
              const geometry =
                await fetchGeometry(
                  featureRef.layer_url,
                  featureRef.object_id
                );

              if (
                !geometry?.features
                  ?.length
              ) {
                return;
              }

              const layer: HazardLayer =
                {
                  type,
                  title:
                    hazard.title ??
                    hazardLabels[type],
                  status:
                    hazard.status ??
                    "unknown",
                  distance:
                    getHazardDistance(
                      hazard
                    ),
                  geometry,
                };

              if (!cancelled) {
                setHazardLayers(
                  (previous) => {
                    const withoutOld =
                      previous.filter(
                        (item) =>
                          item.type !==
                          type
                      );

                    return [
                      ...withoutOld,
                      layer,
                    ];
                  }
                );
              }
            } catch (
              geometryError
            ) {
              console.error(
                `Failed to load ${type}:`,
                geometryError
              );
            }
          };

        await Promise.allSettled(
          hazardTypes.map(
            loadOneHazard
          )
        );
      } catch (loadError) {
        console.error(
          "Hazard loading error:",
          loadError
        );
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
  }, [location]);

  const primaryHazard =
    useMemo(() => {
      const relevantTypes =
        seasonalHazards[season];

      const candidates =
        hazardLayers
          .filter((hazard) =>
            relevantTypes.includes(
              hazard.type
            )
          )
          .filter((hazard) =>
            Number.isFinite(
              hazard.distance
            )
          )
          .sort(
            (a, b) =>
              a.distance -
              b.distance
          );

      return candidates[0] ?? null;
    }, [hazardLayers, season]);

  function changeSeason(
    nextSeason: Season
  ) {
    setSeason(nextSeason);

    const nextPrimary = hazardLayers
      .filter((hazard) =>
        seasonalHazards[
          nextSeason
        ].includes(hazard.type)
      )
      .filter((hazard) =>
        Number.isFinite(
          hazard.distance
        )
      )
      .toSorted(
        (a, b) =>
          a.distance - b.distance
      )[0];

    if (nextPrimary) {
      setVisibleHazards(
        (previous) => ({
          ...previous,
          [nextPrimary.type]: true,
        })
      );
    }
  }

  function toggleHazard(
    type: string
  ) {
    setVisibleHazards(
      (previous) => ({
        ...previous,
        [type]:
          !previous[type],
      })
    );
  }

  function toggleResource(
    kind: string
  ) {
    setVisibleResources(
      (previous) => ({
        ...previous,
        [kind]:
          !previous[kind],
      })
    );
  }

  async function generateAdvice(
    hazard: HazardLayer,
    feature: any
  ) {
    try {
      setLoadingAdvice(true);
      setAdvice(null);

      const response = await fetch(
        `${API_BASE}/ai/advice`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            hazard: hazard.type,
            title: hazard.title,
            status: hazard.status,
            distance:
              Number.isFinite(
                hazard.distance
              )
                ? hazard.distance
                : null,
            season,
            properties:
              feature.properties ?? {},
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to generate advice."
        );
      }

      const data =
        await response.json();

      setAdvice(data);
    } catch (adviceError) {
      console.error(
        "Advice error:",
        adviceError
      );

      setAdvice({
        summary:
          "Safety guidance is temporarily unavailable.",
        tips: [
          "Monitor official emergency information.",
          "Keep emergency supplies available.",
          "Know your local evacuation routes and resources.",
        ],
        note:
          "Mapped hazard data is not a real-time emergency warning.",
      });
    } finally {
      setLoadingAdvice(false);
    }
  }

  return (
    <main
      className="app-screen"
      style={{
        background: "#f8fafc",
      }}
    >
      <section className="map-controls">
        <div className="map-controls-header">
          <div>
            <p className="eyebrow">
              GLENDALE GUARDIAN
            </p>

            <h1>My Area</h1>

            <p className="location-caption">
              {locationSource ===
              "device"
                ? "Viewing your current location"
                : `Viewing selected property: ${selectedProperty.address}`}
            </p>
            <button
              type="button"
              className="map-location-button"
              onClick={useCurrentLocation}
            >
              Use my current location
            </button>
          </div>
        </div>

        <label
          htmlFor="season"
          className="control-label"
        >
          Seasonal Hazard View
        </label>

        <select
          id="season"
          value={season}
          onChange={(event) =>
            changeSeason(
              event.target
                .value as Season
            )
          }
          className="season-select"
        >
          <option value="spring">
            Spring
          </option>
          <option value="summer">
            Summer
          </option>
          <option value="fall">
            Fall
          </option>
          <option value="winter">
            Winter
          </option>
        </select>

        {primaryHazard && (
          <div className="primary-hazard-card">
            <div>
              <p className="primary-hazard-label">
                Closest seasonal hazard
              </p>

              <strong>
                {
                  hazardLabels[
                    primaryHazard
                      .type
                  ]
                }
              </strong>
            </div>

            <span
              className={`status-badge ${
                primaryHazard.distance ===
                0
                  ? "status-in-zone"
                  : "status-nearby"
              }`}
            >
              {primaryHazard.distance ===
              0
                ? "In mapped area"
                : `${Math.round(
                    primaryHazard.distance
                  )} m away`}
            </span>
          </div>
        )}

        <div className="layer-section">
          <div className="section-heading-row">
            <span className="section-heading">
              Hazard layers
            </span>

            <span className="section-helper">
              {loadingHazards
                ? "Loading GIS layers…"
                : "Tap a shape for AI advice"}
            </span>
          </div>

          <div className="chip-row">
            {hazardTypes.map(
              (type) => {
                const styles =
                  getHazardStyle(
                    type
                  );

                const active =
                  visibleHazards[
                    type
                  ];

                const loaded =
                  hazardLayers.some(
                    (hazard) =>
                      hazard.type ===
                      type
                  );

                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!loaded}
                    onClick={() =>
                      toggleHazard(
                        type
                      )
                    }
                    className={`filter-chip ${
                      active
                        ? "filter-chip-active"
                        : ""
                    }`}
                    style={
                      active
                        ? {
                            background:
                              styles.fillColor,
                            borderColor:
                              styles.color,
                            color:
                              "white",
                          }
                        : undefined
                    }
                  >
                    {active
                      ? "✓ "
                      : ""}
                    {
                      hazardLabels[
                        type
                      ]
                    }
                  </button>
                );
              }
            )}
          </div>
        </div>

        <div className="layer-section">
          <div className="section-heading-row">
            <span className="section-heading">
              Nearby resources
            </span>

            <span className="section-helper">
              {loadingResources
                ? "Loading resources…"
                : `${resourceMarkers.length} loaded`}
            </span>
          </div>

          <div className="chip-row">
            {resourceKinds.map(
              (kind) => {
                const active =
                  visibleResources[
                    kind
                  ];

                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      toggleResource(
                        kind
                      )
                    }
                    className={`filter-chip ${
                      active
                        ? "filter-chip-active"
                        : ""
                    }`}
                    style={
                      active
                        ? {
                            background:
                              resourceColors[
                                kind
                              ],
                            borderColor:
                              resourceColors[
                                kind
                              ],
                            color:
                              "white",
                          }
                        : undefined
                    }
                  >
                    {active
                      ? "✓ "
                      : ""}
                    {
                      resourceLabels[
                        kind
                      ]
                    }
                  </button>
                );
              }
            )}
          </div>
        </div>
      </section>

      <section className="map-shell">
        <div
          className="map-legend"
          aria-hidden="true"
        >
          <span>
            <i
              style={{
                background:
                  resourceColors
                    .fire_stations,
              }}
            />
            Fire
          </span>

          <span>
            <i
              style={{
                background:
                  resourceColors
                    .police_stations,
              }}
            />
            Police
          </span>

          <span>
            <i
              style={{
                background:
                  resourceColors
                    .hospitals,
              }}
            />
            Hospital
          </span>
        </div>

        <MapContainer
          center={location}
          zoom={11}
          className="guardian-map"
        >
          <RecenterMap
            position={location}
          />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker
            position={location}
          >
            <Popup>
              {locationSource ===
              "device"
                ? "You are here"
                : "Demo property"}
            </Popup>
          </Marker>

          <Pane
            name="hazardPane"
            style={{ zIndex: 400 }}
          >
            {hazardLayers
              .filter(
                (hazard) =>
                  visibleHazards[
                    hazard.type
                  ]
              )
              .map((hazard) => {
                const styles =
                  getHazardStyle(
                    hazard.type
                  );

                const isPrimary =
                  hazard.type ===
                  primaryHazard?.type;

                return (
                  <GeoJSON
                    key={`${hazard.type}-${season}`}
                    data={
                      hazard.geometry
                    }
                    pane="hazardPane"
                    style={{
                      color:
                        styles.color,
                      fillColor:
                        styles.fillColor,
                      weight:
                        isPrimary
                          ? 3
                          : 2,
                      opacity: 0.9,
                      fillOpacity:
                        isPrimary
                          ? 0.27
                          : 0.12,
                    }}
                    onEachFeature={(
                      feature,
                      layer
                    ) => {
                      layer.on(
                        "click",
                        () => {
                          setSelectedHazard(
                            {
                              type:
                                hazard.type,
                              title:
                                hazard.title,
                              status:
                                hazard.status,
                              distance:
                                hazard.distance,
                              properties:
                                feature.properties,
                            }
                          );

                          generateAdvice(
                            hazard,
                            feature
                          );
                        }
                      );
                    }}
                  />
                );
              })}
          </Pane>

          <Pane
            name="resourcePane"
            style={{ zIndex: 650 }}
          >
            {resourceMarkers
              .filter(
                (resource) =>
                  visibleResources[
                    resource.kind
                  ]
              )
              .map(
                (
                  resource,
                  index
                ) => (
                  <CircleMarker
                    key={`${resource.kind}-${resource.name}-${index}`}
                    center={
                      resource.position
                    }
                    pane="resourcePane"
                    radius={10}
                    bubblingMouseEvents={
                      false
                    }
                    pathOptions={{
                      color:
                        "#ffffff",
                      weight: 3,
                      fillColor:
                        resourceColors[
                          resource.kind
                        ] ??
                        "#475569",
                      fillOpacity: 1,
                    }}
                  >
                    <Popup>
                      <div className="resource-popup">
                        <span
                          className="resource-popup-type"
                          style={{
                            color:
                              resourceColors[
                                resource
                                  .kind
                              ],
                          }}
                        >
                          {resourceLabels[
                            resource.kind
                          ] ??
                            "Resource"}
                        </span>

                        <strong>
                          {
                            resource.name
                          }
                        </strong>

                        {resource.address && (
                          <span>
                            {
                              resource.address
                            }
                          </span>
                        )}

                        <span className="resource-popup-distance">
                          About{" "}
                          {Math.round(
                            resource.distance
                          )}{" "}
                          meters away
                        </span>
                      </div>
                    </Popup>
                  </CircleMarker>
                )
              )}
          </Pane>
        </MapContainer>
      </section>

      {selectedHazard && (
        <div
          className="advice-backdrop"
          onClick={() => {
            setSelectedHazard(
              null
            );
            setAdvice(null);
          }}
        >
          <aside
            className="advice-sheet"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="sheet-handle" />

            <button
              type="button"
              className="sheet-close"
              aria-label="Close safety guidance"
              onClick={() => {
                setSelectedHazard(
                  null
                );
                setAdvice(null);
              }}
            >
              ×
            </button>

            <div className="advice-title-row">
              <div>
                <p className="eyebrow">
                  Mapped hazard
                </p>

                <h2>
                  {
                    selectedHazard.title
                  }
                </h2>
              </div>

              <span
                className={`status-badge ${
                  selectedHazard.distance ===
                  0
                    ? "status-in-zone"
                    : "status-nearby"
                }`}
              >
                {selectedHazard.distance ===
                0
                  ? "In mapped area"
                  : `${Math.round(
                      selectedHazard.distance
                    )} m away`}
              </span>
            </div>

            {loadingAdvice && (
              <div className="advice-loading">
                <span className="loading-dot" />
                Generating safety
                guidance…
              </div>
            )}

            {advice && (
              <div className="advice-content">
                <h3>
                  AI safety guidance
                </h3>

                <p>
                  {
                    advice.summary
                  }
                </p>

                {advice.tips
                  ?.length > 0 && (
                  <ul>
                    {advice.tips.map(
                      (tip) => (
                        <li
                          key={tip}
                        >
                          {tip}
                        </li>
                      )
                    )}
                  </ul>
                )}

                {advice.note && (
                  <p className="advice-note">
                    {
                      advice.note
                    }
                  </p>
                )}
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
