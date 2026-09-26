import { useEffect, useMemo, useState } from "react";

import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from "react-leaflet";

import BottomNav from "../components/BottomNav";
import { getHazardStyle } from "../styles/hazardStyles";

type Season =
  | "spring"
  | "summer"
  | "fall"
  | "winter";

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

function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1;

  if (month >= 3 && month <= 5) {
    return "spring";
  }

  if (month >= 6 && month <= 8) {
    return "summer";
  }

  if (month >= 9 && month <= 11) {
    return "fall";
  }

  return "winter";
}

/*
  Calculates how far away a hazard is.

  If the user is already inside the hazard,
  its distance is treated as zero.
*/
function getHazardDistance(
  hazard: any
): number {
  if (
    hazard.status === "in_zone" &&
    hazard.matches?.length > 0
  ) {
    return 0;
  }

  if (
    hazard.nearest?.distance_m != null
  ) {
    return hazard.nearest.distance_m;
  }

  /*
    Some datasets such as wildfire return
    nearest_by_class instead of nearest.
  */
  if (hazard.nearest_by_class) {
    const distances = Object.values(
      hazard.nearest_by_class
    )
      .map(
        (item: any) =>
          item?.distance_m
      )
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

/*
  Gets the actual GIS feature reference
  that we can use to retrieve the polygon.
*/
function getHazardFeatureRef(
  hazard: any
) {
  /*
    User is already inside the hazard.
  */
  if (
    hazard.status === "in_zone" &&
    hazard.matches?.length > 0
  ) {
    return hazard.matches[0].ref;
  }

  /*
    Standard nearest feature.
  */
  if (hazard.nearest?.ref) {
    return hazard.nearest.ref;
  }

  /*
    Wildfire / other classified datasets.
  */
  if (hazard.nearest_by_class) {
    const candidates = Object.values(
      hazard.nearest_by_class
    ) as any[];

    const closest = candidates
      .filter(
        (item) =>
          item?.ref &&
          typeof item?.distance_m ===
            "number"
      )
      .sort(
        (a, b) =>
          a.distance_m -
          b.distance_m
      )[0];

    return closest?.ref ?? null;
  }

  return null;
}

function MapPage() {
  const [location, setLocation] =
    useState<[number, number] | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [loadingHazards, setLoadingHazards] =
    useState(false);

  const [season, setSeason] =
    useState<Season>(
      getCurrentSeason()
    );

  const [hazardLayers, setHazardLayers] =
    useState<HazardLayer[]>([]);

  const [selectedHazard, setSelectedHazard] = useState<any>(null);
  const [advice, setAdvice] = useState<any>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  /*
    Start everything off.

    Once GIS data loads, the closest
    seasonal hazard will automatically
    be enabled.
  */
  const [
    visibleHazards,
    setVisibleHazards,
  ] = useState<Record<string, boolean>>({
    wildfire: false,
    flood: false,
    fault: false,
    liquefaction: false,
    landslide: false,
    dam_inundation: false,
    debris_flow: false,
  });

  /*
    --------------------------------
    GET USER LOCATION
    --------------------------------
  */

  useEffect(() => {
    if (!navigator.geolocation) {
      setError(
        "Geolocation is not supported by this browser."
      );

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
        console.error(
          "Location error:",
          err
        );

        setError(
          "Unable to get your location."
        );
      }
    );
  }, []);

  /*
    --------------------------------
    FETCH GIS DATA ONCE
    --------------------------------

    IMPORTANT:

    This only depends on location.

    Changing seasons does NOT refetch
    the GIS data.
  */

  useEffect(() => {
    if (!location) {
      return;
    }

    const [lat, lon] = location;

    let cancelled = false;

    async function loadHazards() {
      try {
        setLoadingHazards(true);

        /*
          First get the GIS hazard
          information for this location.
        */

        const response = await fetch(
          `http://127.0.0.1:8000/hazards?lat=${lat}&lon=${lon}`
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load hazard data."
          );
        }

        const data =
          await response.json();

        console.log(
          "Hazard data:",
          data
        );

        const layers: HazardLayer[] =
          [];

        /*
          Load each geometry once.

          Each individual hazard is
          protected with its own try/catch
          so one broken GIS layer does not
          crash the whole map.
        */

        for (
          const type of hazardTypes
        ) {
          const hazard = data[type];

          if (!hazard) {
            continue;
          }

          const featureRef =
            getHazardFeatureRef(
              hazard
            );

          if (!featureRef) {
            console.log(
              `No feature found for ${type}`
            );

            continue;
          }

          try {
            const geometryResponse =
              await fetch(
                `http://127.0.0.1:8000/feature-geometry?layer_url=${encodeURIComponent(
                  featureRef.layer_url
                )}&object_id=${featureRef.object_id}`
              );

            if (
              !geometryResponse.ok
            ) {
              console.error(
                `Geometry request failed for ${type}`
              );

              continue;
            }

            const geometry =
              await geometryResponse.json();

            /*
              Don't render an empty or invalid
              FeatureCollection.
            */
            if (
              !geometry?.features ||
              geometry.features.length === 0
            ) {
              console.log(
                `No geometry returned for ${type}`
              );

              continue;
            }

            layers.push({
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
            });
          } catch (geometryError) {
            console.error(
              `Failed to load ${type}:`,
              geometryError
            );
          }
        }

        if (!cancelled) {
          console.log(
            "Loaded hazard layers:",
            layers
          );

          setHazardLayers(
            layers
          );
        }
      } catch (loadError) {
        console.error(
          "Hazard loading error:",
          loadError
        );
      } finally {
        if (!cancelled) {
          setLoadingHazards(
            false
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
    --------------------------------
    CALCULATE PRIMARY SEASONAL HAZARD
    --------------------------------

    No API call happens here.

    We are using the GIS data we
    already downloaded.
  */

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

      return (
        candidates[0] ?? null
      );
    }, [
      hazardLayers,
      season,
    ]);

  /*
    Automatically turn on the closest
    seasonal hazard whenever the season
    changes.
  */

  useEffect(() => {
    if (!primaryHazard) {
      return;
    }

    setVisibleHazards(
      (previous) => ({
        ...previous,

        [primaryHazard.type]:
          true,
      })
    );
  }, [primaryHazard]);

  /*
    --------------------------------
    TOGGLE HAZARD
    --------------------------------
  */

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

  /*
    --------------------------------
    LOCATION ERROR
    --------------------------------
  */

  if (error) {
    return (
      <main className="app-screen">
        <div
          style={{
            padding: "24px",
          }}
        >
          <h1>My Area</h1>

          <p>{error}</p>
        </div>

        <BottomNav />
      </main>
    );
  }

  /*
    --------------------------------
    LOCATION LOADING
    --------------------------------
  */

  if (!location) {
    return (
      <main className="app-screen">
        <div
          style={{
            padding: "24px",
          }}
        >
          <h1>My Area</h1>

          <p>
            Getting your
            location...
          </p>
        </div>

        <BottomNav />
      </main>
    );
  }

  return (
    <main
      className="app-screen"
      style={{
        background:
          "#f8fafc",
      }}
    >
      {/* HEADER */}

      <div
        style={{
          padding: "16px",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom:
              "16px",
          }}
        >
          My Area
        </h1>

        {/* SEASON */}

        <label
          htmlFor="season"
          style={{
            display: "block",
            fontSize: "14px",
            fontWeight: 600,
            marginBottom:
              "6px",
          }}
        >
          Seasonal Hazard View
        </label>

      <select
  id="season"
  value={season}
  onChange={(event) =>
    setSeason(event.target.value as Season)
  }
  style={{
    width: "100%",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #cbd5e1",
    background: "white",
    color: "#0f172a",
    fontSize: "16px",
  }}
>
  <option value="spring">Spring</option>
  <option value="summer">Summer</option>
  <option value="fall">Fall</option>
  <option value="winter">Winter</option>
</select>

        {/* PRIMARY HAZARD */}

        {primaryHazard && (
          <div
            style={{
              marginTop:
                "12px",
              padding: "12px",
              borderRadius:
                "10px",
              background:
                "white",
              border:
                "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize:
                  "12px",
                color:
                  "#64748b",
              }}
            >
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

            {primaryHazard.distance ===
            0 ? (
              <div
                style={{
                  fontSize:
                    "13px",
                  marginTop:
                    "4px",
                }}
              >
                Your location
                overlaps this
                mapped hazard.
              </div>
            ) : (
              <div
                style={{
                  fontSize:
                    "13px",
                  marginTop:
                    "4px",
                  color:
                    "#475569",
                }}
              >
                About{" "}
                {Math.round(
                  primaryHazard.distance
                )}{" "}
                meters away
              </div>
            )}
          </div>
        )}

        {loadingHazards && (
          <p
            style={{
              fontSize: "13px",
              color:
                "#64748b",
            }}
          >
            Loading GIS hazard
            layers...
          </p>
        )}

        {/* HAZARD TOGGLES */}

        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX:
              "auto",
            paddingTop:
              "14px",
            paddingBottom:
              "4px",
          }}
        >
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
                  disabled={
                    !loaded
                  }
                  onClick={() =>
                    toggleHazard(
                      type
                    )
                  }
                  style={{
                    flexShrink: 0,
                    padding:
                      "9px 13px",
                    borderRadius:
                      "999px",
                    border: active
                      ? `2px solid ${styles.color}`
                      : "1px solid #cbd5e1",

                    background:
                      active
                        ? styles.fillColor
                        : "white",

                    color: active
                      ? "white"
                      : "#334155",

                    opacity:
                      loaded
                        ? 1
                        : 0.4,

                    cursor:
                      loaded
                        ? "pointer"
                        : "not-allowed",

                    fontWeight:
                      active
                        ? 600
                        : 400,
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
            }
          )}
        </div>
      </div>

      {/* MAP */}

      <MapContainer
        center={location}
        zoom={11}
        style={{
          height:
            "calc(100vh - 330px)",
          minHeight:
            "400px",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* USER */}

        <Marker
          position={location}
        >
          <Popup>
            You are here
          </Popup>
        </Marker>

        {/* HAZARDS */}

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
                /*
                  Including season in the key
                  guarantees Leaflet refreshes
                  the visual style when the
                  season changes.
                */
                key={`${hazard.type}-${season}`}
                data={
                  hazard.geometry
                }
                style={{
                  color:
                    styles.color,

                  fillColor:
                    styles.fillColor,

                  weight:
                    isPrimary
                      ? 4
                      : 2,

                  fillOpacity:
                    isPrimary
                      ? 0.45
                      : 0.18,
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

    setAdvice(null);
  });
}}
              />
            );
          })}
      </MapContainer>

      {selectedHazard && (
  <div
    style={{
      position: "absolute",
      bottom: "72px",
      left: "12px",
      right: "12px",
      background: "white",
      padding: "18px",
      borderRadius: "18px",
      zIndex: 1000,
      boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
    }}
  >
    <button
      onClick={() => {
        setSelectedHazard(null);
        setAdvice(null);
      }}
      style={{
        float: "right",
        border: "none",
        background: "transparent",
        fontSize: "20px",
      }}
    >
      ×
    </button>

    <h2>{selectedHazard.title}</h2>

    <p>
      {selectedHazard.distance === 0
        ? "Your location overlaps this mapped hazard area."
        : `This mapped hazard is about ${Math.round(
            selectedHazard.distance
          )} meters away.`}
    </p>

    {loadingAdvice && (
      <p>Generating safety advice...</p>
    )}

    {advice && (
      <>
        <h3>Safety Advice</h3>

        <p>{advice.summary}</p>

        <ul>
          {advice.tips?.map((tip: string) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </>
    )}
  </div>
)}

      <BottomNav />
    </main>
  );
}

export default MapPage;