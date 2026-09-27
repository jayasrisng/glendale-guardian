import { useEffect, useMemo, useState } from "react";
import { useConversation } from "@elevenlabs/react";

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
import { Link } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import { getHazardStyle } from "../styles/hazardStyles";

type Season =
  | "spring"
  | "summer"
  | "fall"
  | "winter";

type ResourceMarker = {
  kind: string;
  name: string;
  address: string | null;
  distance: number;
  position: [number, number];
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

const defaultPropertyLocation: [
  number,
  number,
] = [
  34.184034,
  -118.2294045,
];


function loadSelectedProperty() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        "glendale-guardian-assessment-v2",
      ) ?? "{}",
    );

    const lat =
      saved.hazards?.location?.lat;

    const lon =
      saved.hazards?.location?.lon;

    return {
      location:
        Number.isFinite(lat) &&
        Number.isFinite(lon)
          ? ([lat, lon] as [
              number,
              number,
            ])
          : defaultPropertyLocation,

      address:
        saved.resident?.address ||
        "2527 Canada Blvd, Glendale, CA 91208",
    };
  } catch {
    return {
      location:
        defaultPropertyLocation,
      address:
        "2527 Canada Blvd, Glendale, CA 91208",
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

const hazardLabels: Record<
  string,
  string
> = {
  wildfire: "Wildfire",
  flood: "Flood",
  fault: "Fault Zone",
  liquefaction: "Liquefaction",
  landslide: "Landslide",
  dam_inundation: "Dam Inundation",
  debris_flow: "Debris Flow",
};

const seasonalHazards: Record<
  Season,
  string[]
> = {
  spring: [
    "flood",
    "landslide",
    "debris_flow",
  ],

  summer: [
    "wildfire",
  ],

  fall: [
    "wildfire",
    "debris_flow",
  ],

  winter: [
    "flood",
    "landslide",
    "debris_flow",
    "dam_inundation",
  ],
};

const resourceKinds = [
  "fire_stations",
  "police_stations",
  "hospitals",
];

const resourceLabels: Record<
  string,
  string
> = {
  fire_stations: "Fire",
  police_stations: "Police",
  hospitals: "Hospitals",
};

const resourceColors: Record<
  string,
  string
> = {
  fire_stations: "#dc2626",
  police_stations: "#2563eb",
  hospitals: "#16a34a",
};

/*
  Cache feature geometry so React
  doesn't make duplicate ArcGIS requests.
*/
const geometryCache = new Map<
  string,
  Promise<any>
>();

async function fetchGeometry(
  layerUrl: string,
  objectId: number,
) {
  const key =
    `${layerUrl}:${objectId}`;

  if (!geometryCache.has(key)) {
    geometryCache.set(
      key,
      fetch(
        `${API_BASE}/feature-geometry?layer_url=${encodeURIComponent(
          layerUrl,
        )}&object_id=${objectId}`,
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Geometry request failed (${response.status})`,
          );
        }

        return response.json();
      }),
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
    map.setView(
      position,
      map.getZoom(),
    );
  }, [map, position]);

  return null;
}

function getCurrentSeason(): Season {
  const month =
    new Date().getMonth() + 1;

  if (
    month >= 3 &&
    month <= 5
  ) {
    return "spring";
  }

  if (
    month >= 6 &&
    month <= 8
  ) {
    return "summer";
  }

  if (
    month >= 9 &&
    month <= 11
  ) {
    return "fall";
  }

  return "winter";
}

function getHazardDistance(
  hazard: any,
): number {
  /*
    FEMA Zone X can technically be an
    intersecting polygon while not being
    a Special Flood Hazard Area.

    Prefer the closest special flood
    area for map visualization.
  */
  if (
    hazard.dataset ===
      "fema_flood_zones" &&
    hazard.matches?.[0]?.attributes
      ?.SFHA_TF !== "T"
  ) {
    const distances =
      Object.values(
        hazard.nearest_by_class ?? {},
      )
        .filter(
          (item: any) =>
            item?.attributes
              ?.SFHA_TF === "T",
        )
        .map(
          (item: any) =>
            item.distance_m,
        )
        .filter(
          (
            distance,
          ): distance is number =>
            typeof distance ===
            "number",
        );

    if (distances.length > 0) {
      return Math.min(
        ...distances,
      );
    }
  }

  if (
    hazard.status ===
      "in_zone" &&
    hazard.matches?.length > 0
  ) {
    return 0;
  }

  if (
    hazard.nearest
      ?.distance_m != null
  ) {
    return hazard.nearest
      .distance_m;
  }

  if (
    hazard.nearest_by_class
  ) {
    const distances =
      Object.values(
        hazard.nearest_by_class,
      )
        .map(
          (item: any) =>
            item?.distance_m,
        )
        .filter(
          (
            distance,
          ): distance is number =>
            typeof distance ===
            "number",
        );

    if (distances.length > 0) {
      return Math.min(
        ...distances,
      );
    }
  }

  return Infinity;
}

function getHazardFeatureRef(
  hazard: any,
) {
  /*
    For FEMA flood data, if the
    current polygon isn't a Special
    Flood Hazard Area, show the
    closest SFHA polygon instead.
  */
  if (
    hazard.dataset ===
      "fema_flood_zones" &&
    hazard.matches?.[0]?.attributes
      ?.SFHA_TF !== "T"
  ) {
    const nearestSpecialFlood =
      Object.values(
        hazard.nearest_by_class ?? {},
      )
        .filter(
          (item: any) =>
            item?.ref &&
            item?.attributes
              ?.SFHA_TF === "T" &&
            typeof item.distance_m ===
              "number",
        )
        .sort(
          (a: any, b: any) =>
            a.distance_m -
            b.distance_m,
        )[0] as any;

    if (
      nearestSpecialFlood?.ref
    ) {
      return nearestSpecialFlood.ref;
    }
  }

  if (
    hazard.status ===
      "in_zone" &&
    hazard.matches?.length > 0
  ) {
    return hazard.matches[0]
      .ref;
  }

  if (
    hazard.nearest?.ref
  ) {
    return hazard.nearest.ref;
  }

  if (
    hazard.nearest_by_class
  ) {
    const candidates =
      Object.values(
        hazard.nearest_by_class,
      ) as any[];

    const closest =
      candidates
        .filter(
          (item) =>
            item?.ref &&
            typeof item
              ?.distance_m ===
              "number",
        )
        .sort(
          (a, b) =>
            a.distance_m -
            b.distance_m,
        )[0];

    return closest?.ref ?? null;
  }

  return null;
}

function MapPage() {
  const selectedProperty =
    useMemo(
      () =>
        loadSelectedProperty(),
      [],
    );

  const [
    location,
    setLocation,
  ] = useState<
    [number, number]
  >(
    selectedProperty.location,
  );

  const [
    locationSource,
    setLocationSource,
  ] = useState<
    "property" | "device"
  >("property");

  const [
    season,
    setSeason,
  ] = useState<Season>(
    getCurrentSeason(),
  );

  const [
    hazardLayers,
    setHazardLayers,
  ] = useState<
    HazardLayer[]
  >([]);

  const [
    resourceMarkers,
    setResourceMarkers,
  ] = useState<
    ResourceMarker[]
  >([]);

  const [
    loadingHazards,
    setLoadingHazards,
  ] = useState(false);

  const [
    loadingResources,
    setLoadingResources,
  ] = useState(false);

  const [
    selectedHazard,
    setSelectedHazard,
  ] = useState<any>(null);

  const [
    agentText,
    setAgentText,
  ] = useState("");

  const [
    sendingHazardContext,
    setSendingHazardContext,
  ] = useState(false);

  /*
    ELEVENLABS
  */
  const conversation =
    useConversation({
      onMessage: ({
        message,
        role,
      }) => {
        if (
          role === "agent"
        ) {
          setAgentText(
            message,
          );

          setSendingHazardContext(
            false,
          );
        }
      },

      onError: (error) => {
        console.error(
          "Guardian conversation error:",
          error,
        );

        setAgentText(
          "Guardian guidance is temporarily unavailable.",
        );

        setSendingHazardContext(
          false,
        );
      },
    });

  const [
    visibleHazards,
    setVisibleHazards,
  ] = useState<
    Record<
      string,
      boolean
    >
  >({
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
  ] = useState<
    Record<
      string,
      boolean
    >
  >({
    fire_stations: true,
    police_stations: true,
    hospitals: true,
  });

  function useCurrentLocation() {
    if (
      !navigator.geolocation
    ) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation([
          position.coords
            .latitude,
          position.coords
            .longitude,
        ]);

        setLocationSource(
          "device",
        );
      },

      (error) => {
        console.error(
          "Location error:",
          error,
        );
      },
    );
  }

  /*
    LOAD NEARBY RESOURCES
  */
  useEffect(() => {
    const [
      lat,
      lon,
    ] = location;

    let cancelled = false;

    setResourceMarkers([]);

    async function loadResources() {
      try {
        setLoadingResources(
          true,
        );

        const response =
          await fetch(
            `${API_BASE}/resources?lat=${lat}&lon=${lon}&limit=2`,
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Unable to load resources.",
          );
        }

        const data =
          await response.json();

        const requests =
          (
            data.groups ??
            []
          )
            .filter(
              (
                group: any,
              ) =>
                resourceKinds.includes(
                  group.kind,
                ),
            )
            .flatMap(
              (
                group: any,
              ) =>
                (
                  group.results ??
                  []
                ).map(
                  async (
                    resource: any,
                  ) => {
                    const ref =
                      resource.ref;

                    if (
                      !ref
                    ) {
                      return;
                    }

                    try {
                      const geometry =
                        await fetchGeometry(
                          ref.layer_url,
                          ref.object_id,
                        );

                      const feature =
                        geometry
                          .features?.[0];

                      if (
                        !feature ||
                        feature
                          .geometry
                          ?.type !==
                          "Point"
                      ) {
                        return;
                      }

                      const [
                        longitude,
                        latitude,
                      ] =
                        feature
                          .geometry
                          .coordinates;

                      const marker: ResourceMarker =
                        {
                          kind:
                            group.kind,

                          name:
                            resource.name ??
                            group.title,

                          address:
                            resource.address ??
                            null,

                          distance:
                            resource.distance_m,

                          position:
                            [
                              latitude,
                              longitude,
                            ],
                        };

                      if (
                        !cancelled
                      ) {
                        setResourceMarkers(
                          (
                            previous,
                          ) => {
                            const duplicate =
                              previous.some(
                                (
                                  item,
                                ) =>
                                  item.kind ===
                                    marker.kind &&
                                  item.name ===
                                    marker.name,
                              );

                            if (
                              duplicate
                            ) {
                              return previous;
                            }

                            return [
                              ...previous,
                              marker,
                            ];
                          },
                        );
                      }
                    } catch (
                      resourceError
                    ) {
                      console.error(
                        "Resource geometry error:",
                        resourceError,
                      );
                    }
                  },
                ),
            );

        await Promise.allSettled(
          requests,
        );
      } catch (
        resourceError
      ) {
        console.error(
          "Resource loading error:",
          resourceError,
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoadingResources(
            false,
          );
        }
      }
    }

    loadResources();

    return () => {
      cancelled = true;
    };
  }, [location]);

  /*
    LOAD HAZARD GIS LAYERS
  */
  useEffect(() => {
    const [
      lat,
      lon,
    ] = location;

    let cancelled = false;

    async function loadHazards() {
      try {
        setLoadingHazards(
          true,
        );

        const response =
          await fetch(
            `${API_BASE}/hazards?lat=${lat}&lon=${lon}`,
          );

        if (
          !response.ok
        ) {
          throw new Error(
            "Unable to load hazard data.",
          );
        }

        const data =
          await response.json();

        const layers: HazardLayer[] =
          [];

        for (
          const type of hazardTypes
        ) {
          const hazard =
            data[type];

          if (
            !hazard
          ) {
            continue;
          }

          const featureRef =
            getHazardFeatureRef(
              hazard,
            );

          if (
            !featureRef
          ) {
            continue;
          }

          try {
            const geometry =
              await fetchGeometry(
                featureRef.layer_url,
                featureRef.object_id,
              );

            if (
              !geometry
                ?.features
                ?.length
            ) {
              continue;
            }

            layers.push({
              type,

              title:
                hazard.title ??
                hazardLabels[
                  type
                ],

              status:
                hazard.status ??
                "unknown",

              distance:
                getHazardDistance(
                  hazard,
                ),

              geometry,
            });
          } catch (
            geometryError
          ) {
            console.error(
              `Failed to load ${type}:`,
              geometryError,
            );
          }
        }

        if (
          !cancelled
        ) {
          setHazardLayers(
            layers,
          );
        }
      } catch (
        loadError
      ) {
        console.error(
          "Hazard loading error:",
          loadError,
        );
      } finally {
        if (
          !cancelled
        ) {
          setLoadingHazards(
            false,
          );
        }
      }
    }

    loadHazards();

    return () => {
      cancelled = true;
    };
  }, [location]);

  /*
    FIND CLOSEST SEASONAL
    HAZARD
  */
  const primaryHazard =
    useMemo(() => {
      const relevantTypes =
        seasonalHazards[
          season
        ];

      const candidates =
        hazardLayers
          .filter(
            (hazard) =>
              relevantTypes.includes(
                hazard.type,
              ),
          )
          .filter(
            (hazard) =>
              Number.isFinite(
                hazard.distance,
              ),
          )
          .toSorted(
            (a, b) =>
              a.distance -
              b.distance,
          );

      return (
        candidates[0] ??
        null
      );
    }, [
      hazardLayers,
      season,
    ]);

  /*
    Automatically display the
    closest seasonal hazard.
  */
  useEffect(() => {
    if (
      !primaryHazard
    ) {
      return;
    }

    setVisibleHazards(
      (previous) => ({
        ...previous,

        [primaryHazard.type]:
          true,
      }),
    );
  }, [primaryHazard]);

  function toggleHazard(
    type: string,
  ) {
    setVisibleHazards(
      (previous) => ({
        ...previous,

        [type]:
          !previous[type],
      }),
    );
  }

  function toggleResource(
    kind: string,
  ) {
    setVisibleResources(
      (previous) => ({
        ...previous,

        [kind]:
          !previous[kind],
      }),
    );
  }

  /*
    SEND HAZARD TO
    ELEVENLABS GUARDIAN
  */
  async function sendHazardToGuardian(
    hazard: HazardLayer,
    feature: any,
  ) {
    try {
      setSendingHazardContext(
        true,
      );

      setAgentText("");

      const distanceText =
        Number.isFinite(
          hazard.distance,
        )
          ? hazard.distance ===
            0
            ? "The selected property overlaps this mapped hazard area."
            : `This mapped hazard is approximately ${Math.round(
                hazard.distance,
              )} meters from the selected property.`
          : "Distance information is unavailable.";

      const prompt = [
        "The resident selected a hazard on the Glendale Guardian map.",
        "",
        `Hazard: ${hazard.title}`,
        `Hazard type: ${hazard.type}`,
        `GIS status: ${hazard.status}`,
        distanceText,
        `Seasonal view: ${season}`,
        `Property: ${
          locationSource ===
          "property"
            ? selectedProperty.address
            : "the resident's current location"
        }`,
        `GIS feature attributes: ${JSON.stringify(
          feature.properties ??
            {},
        )}`,
        "",
        "Give the resident 3 concise and practical safety or preparedness tips related to this hazard.",
        "Use the mapped public data only as context.",
        "Do not describe this as a real-time emergency, active incident, forecast, or site-specific engineering assessment.",
      ].join("\n");

      /*
        Start Guardian if there
        isn't already a conversation.
      */
      if (
        conversation.status !==
        "connected"
      ) {
        /*
          ElevenLabs voice/WebRTC
          needs microphone permission.
        */
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: true,
            },
          );

        stream
          .getTracks()
          .forEach(
            (track) =>
              track.stop(),
          );

        const tokenResponse =
          await fetch(
            `${API_BASE}/conversation-token`,
          );

        const tokenBody =
          await tokenResponse.json();

        if (
          !tokenResponse.ok
        ) {
          throw new Error(
            tokenBody.error ??
              "Unable to obtain Guardian conversation token.",
          );
        }

        await conversation.startSession(
          {
            conversationToken:
              tokenBody.token,

            connectionType:
              "webrtc",

            dynamicVariables:
              {
                selected_hazard_type:
                  hazard.type,

                selected_hazard_title:
                  hazard.title,

                selected_hazard_status:
                  hazard.status,

                selected_hazard_distance_m:
                  Number.isFinite(
                    hazard.distance,
                  )
                    ? String(
                        Math.round(
                          hazard.distance,
                        ),
                      )
                    : "unknown",

                selected_season:
                  season,

                selected_property:
                  selectedProperty.address,

                selected_hazard_properties:
                  JSON.stringify(
                    feature.properties ??
                      {},
                  ),
              },
          },
        );
      }

      /*
        IMPORTANT:

        sendUserMessage prompts
        the ElevenLabs agent to
        actually respond.

        sendContextualUpdate alone
        would only add background
        context.
      */
      conversation.sendUserMessage(
        prompt,
      );
    } catch (error) {
      console.error(
        "Guardian hazard advice error:",
        error,
      );

      setAgentText(
        "Guardian guidance is temporarily unavailable. The mapped hazard information is still available on the map.",
      );

      setSendingHazardContext(
        false,
      );
    }
  }

  return (
    <main
      className="app-screen"
      style={{
        background:
          "#f8fafc",
      }}
    >
      {/* CONTROLS */}

      <section
        style={{
          padding:
            "18px 18px 12px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing:
              "0.14em",
            color: "#35786b",
          }}
        >
          GLENDALE GUARDIAN
        </p>
        <Link
  to="/"
  style={{
    display: "inline-block",
    marginBottom: "12px",
    padding: "8px 12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    textDecoration: "none",
    fontWeight: 600,
  }}
>
  ← Back to Guardian
</Link>

        <h1
          style={{
            margin:
              "8px 0 14px",
          }}
        >
          My Area
        </h1>

        <p>
          {locationSource ===
          "property"
            ? `Viewing selected property: ${selectedProperty.address}`
            : "Viewing your current location"}
        </p>

        <button
          type="button"
          onClick={
            useCurrentLocation
          }
          style={{
            padding:
              "9px 12px",
            borderRadius:
              "10px",
            border:
              "1px solid #cbd5e1",
            background:
              "white",
            cursor:
              "pointer",
          }}
        >
          Use my current
          location
        </button>

        <div
          style={{
            marginTop:
              "14px",
          }}
        >
          <label
            htmlFor="season"
            style={{
              marginRight:
                "8px",
            }}
          >
            Seasonal Hazard
            View
          </label>

          <select
            id="season"
            value={season}
            onChange={(
              event,
            ) =>
              setSeason(
                event.target
                  .value as Season,
              )
            }
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
        </div>

        {primaryHazard && (
          <div
            style={{
              marginTop:
                "14px",
              padding:
                "12px",
              background:
                "white",
              borderRadius:
                "12px",
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div>
              Closest seasonal
              hazard
            </div>

            <strong>
              {
                hazardLabels[
                  primaryHazard
                    .type
                ]
              }
            </strong>

            <div>
              {primaryHazard.distance ===
              0
                ? "In mapped area"
                : `About ${Math.round(
                    primaryHazard.distance,
                  )} meters away`}
            </div>
          </div>
        )}

        <h3>
          Hazard layers
        </h3>

        <p>
          Tap a shape for
          Guardian guidance
        </p>

        <div
          style={{
            display: "flex",
            gap: "4px",
            overflowX:
              "auto",
          }}
        >
          {hazardTypes.map(
            (type) => {
              const styles =
                getHazardStyle(
                  type,
                );

              const active =
                visibleHazards[
                  type
                ];

              const loaded =
                hazardLayers.some(
                  (hazard) =>
                    hazard.type ===
                    type,
                );

              return (
                <button
                  key={type}
                  type="button"
                  disabled={
                    !loaded
                  }
                  onClick={() =>
                    toggleHazard(
                      type,
                    )
                  }
                  style={{
                    padding:
                      "9px 12px",
                    border:
                      active
                        ? `2px solid ${styles.color}`
                        : "1px solid #aaa",
                    background:
                      active
                        ? styles.fillColor
                        : "#fff",
                    color:
                      active
                        ? "#fff"
                        : "#111",
                    opacity:
                      loaded
                        ? 1
                        : 0.4,
                  }}
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
            },
          )}
        </div>

        {loadingHazards && (
          <p>
            Loading hazard
            layers...
          </p>
        )}

        <h3
          style={{
            marginBottom:
              "6px",
          }}
        >
          Nearby resources
        </h3>

        <p>
          {loadingResources
            ? "Loading..."
            : `${resourceMarkers.length} loaded`}
        </p>

        <div
          style={{
            display: "flex",
            gap: "2px",
          }}
        >
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
                      kind,
                    )
                  }
                  style={{
                    background:
                      active
                        ? resourceColors[
                            kind
                          ]
                        : "white",

                    color:
                      active
                        ? "white"
                        : "#111",

                    padding:
                      "9px 12px",

                    border:
                      "1px solid #64748b",
                  }}
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
            },
          )}
        </div>
      </section>

      {/* MAP */}

      <section
        style={{
          position:
            "relative",
        }}
      >
        <MapContainer
          center={location}
          zoom={11}
          style={{
            height:
              "520px",
            width:
              "100%",
          }}
        >
          <RecenterMap
            position={
              location
            }
          />

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* PROPERTY */}

          <Marker
            position={
              location
            }
          >
            <Popup>
              {locationSource ===
              "device"
                ? "You are here"
                : selectedProperty.address}
            </Popup>
          </Marker>

          {/* HAZARDS */}

          <Pane
            name="hazardPane"
            style={{
              zIndex: 400,
            }}
          >
            {hazardLayers
              .filter(
                (hazard) =>
                  visibleHazards[
                    hazard.type
                  ],
              )
              .map(
                (
                  hazard,
                ) => {
                  const styles =
                    getHazardStyle(
                      hazard.type,
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
                            ? 4
                            : 2,

                        opacity:
                          0.9,

                        fillOpacity:
                          isPrimary
                            ? 0.35
                            : 0.17,
                      }}
                      onEachFeature={(
                        feature,
                        layer,
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
                              },
                            );

                            sendHazardToGuardian(
                              hazard,
                              feature,
                            );
                          },
                        );
                      }}
                    />
                  );
                },
              )}
          </Pane>

          {/* RESOURCES */}

          <Pane
            name="resourcePane"
            style={{
              zIndex: 650,
            }}
          >
            {resourceMarkers
              .filter(
                (
                  resource,
                ) =>
                  visibleResources[
                    resource.kind
                  ],
              )
              .map(
                (
                  resource,
                  index,
                ) => (
                  <CircleMarker
                    key={`${resource.kind}-${resource.name}-${index}`}
                    center={
                      resource.position
                    }
                    pane="resourcePane"
                    radius={
                      9
                    }
                    bubblingMouseEvents={
                      false
                    }
                    pathOptions={{
                      color:
                        "#ffffff",

                      weight:
                        3,

                      fillColor:
                        resourceColors[
                          resource
                            .kind
                        ] ??
                        "#475569",

                      fillOpacity:
                        1,
                    }}
                  >
                    <Popup>
                      <strong>
                        {
                          resource.name
                        }
                      </strong>

                      {resource.address && (
                        <div>
                          {
                            resource.address
                          }
                        </div>
                      )}

                      <div>
                        About{" "}
                        {Math.round(
                          resource.distance,
                        )}{" "}
                        meters away
                      </div>
                    </Popup>
                  </CircleMarker>
                ),
              )}
          </Pane>
        </MapContainer>
      </section>

      {/* GUARDIAN ADVICE */}

      {selectedHazard && (
        <div
          style={{
            position:
              "fixed",
            left: "12px",
            right: "12px",
            bottom:
              "82px",
            zIndex:
              2000,
            background:
              "white",
            borderRadius:
              "18px",
            padding:
              "18px",
            boxShadow:
              "0 10px 35px rgba(0,0,0,0.22)",
            maxHeight:
              "45vh",
            overflowY:
              "auto",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setSelectedHazard(
                null,
              );

              setAgentText(
                "",
              );
            }}
            style={{
              float:
                "right",
              border:
                "none",
              background:
                "transparent",
              fontSize:
                "22px",
              cursor:
                "pointer",
            }}
          >
            ×
          </button>

          <h2>
            {
              selectedHazard.title
            }
          </h2>

          <p>
            {selectedHazard.distance ===
            0
              ? "Your selected location overlaps this mapped hazard area."
              : `This mapped hazard is about ${Math.round(
                  selectedHazard.distance,
                )} meters away.`}
          </p>

          {sendingHazardContext &&
            !agentText && (
              <p>
                Asking
                Guardian for
                safety
                guidance...
              </p>
            )}

          {agentText && (
            <>
              <h3>
                Guardian
                Guidance
              </h3>

              <p
                style={{
                  whiteSpace:
                    "pre-wrap",
                  lineHeight:
                    1.5,
                }}
              >
                {agentText}
              </p>
            </>
          )}

          <small>
            Mapped hazard
            information is
            public-data context,
            not a real-time
            emergency warning.
          </small>
        </div>
      )}

      <BottomNav />
    </main>
  );
}

export default MapPage;