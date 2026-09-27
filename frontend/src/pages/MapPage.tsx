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



  const [agentText, setAgentText] =

    useState<string>("");



  const [sendingHazardContext, setSendingHazardContext] =

    useState(false);



  const conversation = useConversation({

    onMessage: ({ message, role }) => {

      if (role === "agent") {

        setAgentText(message);

      }

    },

  });



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



  useEffect(() => {
    if (!primaryHazard) return;

    setVisibleHazards((previous) => ({
      ...previous,
      [primaryHazard.type]: true,
    }));
  }, [primaryHazard]);



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



  async function sendHazardToGuardian(

    hazard: HazardLayer,

    feature: any

  ) {

    try {

      setSendingHazardContext(true);

      setAgentText("");



      const context = [

        `Selected mapped hazard: ${hazard.title}.`,

        `Hazard type: ${hazard.type}.`,

        `GIS status: ${hazard.status}.`,

        Number.isFinite(hazard.distance)

          ? hazard.distance === 0

            ? "The selected location overlaps this mapped hazard."

            : `The mapped hazard is approximately ${Math.round(hazard.distance)} meters away.`

          : "Distance is unavailable.",

        `Selected season: ${season}.`,

        `GIS feature attributes: ${JSON.stringify(feature.properties ?? {})}.`,

        "Use this only as mapped public-data context. Do not describe it as a real-time incident or forecast.",

      ].join("\n");



      if (conversation.status === "connected") {

        conversation.sendContextualUpdate(context);

        return;

      }



      const tokenResponse = await fetch("/api/conversation-token");

      const tokenBody = await tokenResponse.json();



      if (!tokenResponse.ok) {

        throw new Error(

          tokenBody.error ?? "Unable to obtain ElevenLabs conversation token."

        );

      }



      await conversation.startSession({

        conversationToken: tokenBody.token,

        connectionType: "webrtc",

        dynamicVariables: {

          selected_hazard_type: hazard.type,

          selected_hazard_title: hazard.title,

          selected_hazard_status: hazard.status,

          selected_hazard_distance_m: Number.isFinite(hazard.distance)

            ? String(Math.round(hazard.distance))

            : "unknown",

          selected_season: season,

          selected_hazard_properties: JSON.stringify(feature.properties ?? {}),

        },

      });



      conversation.sendContextualUpdate(context);

    } catch (error) {

      console.error("Guardian hazard context error:", error);

      setAgentText(

        "Guardian is temporarily unavailable. The mapped hazard information is still visible on the map."

      );

    } finally {

      setSendingHazardContext(false);

    }

  }



  return (
    <div className="guardian-app">
      <header className="app-header">
        <div className="brand-mark">
          <span className="brand-symbol">
            <img src="/glendale-guardian.png" alt="" />
          </span>
          Glendale Guardian
        </div>

        <div className="property-pill">
          {locationSource === "device"
            ? "Current location"
            : selectedProperty.address}
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="voice-panel">
          <div className="panel-kicker">
            PROPERTY RESILIENCE MAP
          </div>

          <h1>My Area</h1>

          <p className="panel-intro">
            Explore mapped hazards and nearby emergency resources around your property.
          </p>

          <button
            type="button"
            className="map-location-button"
            onClick={useCurrentLocation}
          >
            Use my current location
          </button>

          <div className="transcript-card">
            <div className="section-heading">
              <span>Seasonal hazard view</span>
              <small>Planning context</small>
            </div>

            <select
              id="season"
              value={season}
              onChange={(event) =>
                changeSeason(
                  event.target.value as Season
                )
              }
              style={{
                width: "100%",
                height: "42px",
                padding: "0 10px",
                border: "1px solid #cfd7d1",
                borderRadius: "8px",
                background: "white",
                color: "#263a31",
              }}
            >
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="fall">Fall</option>
              <option value="winter">Winter</option>
            </select>

            {primaryHazard && (
              <article
                className="hazard-card"
                style={{ marginTop: "14px" }}
              >
                <div
                  className="hazard-icon"
                  style={{
                    background:
                      getHazardStyle(
                        primaryHazard.type
                      ).fillColor,
                    color:
                      getHazardStyle(
                        primaryHazard.type
                      ).color,
                  }}
                >
                  !
                </div>

                <div>
                  <div className="hazard-title">
                    <strong>
                      {
                        hazardLabels[
                          primaryHazard.type
                        ]
                      }
                    </strong>

                    <span
                      className="evidence-badge"
                      style={{
                        background:
                          primaryHazard.distance ===
                          0
                            ? "#fee8e5"
                            : "#e0f1e8",
                        color:
                          primaryHazard.distance ===
                          0
                            ? "#b54032"
                            : "#257052",
                      }}
                    >
                      {primaryHazard.distance ===
                      0
                        ? "In mapped area"
                        : `${Math.round(
                            primaryHazard.distance
                          )} m away`}
                    </span>
                  </div>

                  <p>
                    Closest mapped hazard for the selected seasonal view.
                  </p>
                </div>
              </article>
            )}
          </div>

          <div className="transcript-card">
            <div className="section-heading">
              <span>Hazard layers</span>

              <small>
                {loadingHazards
                  ? "Loading GIS layers…"
                  : "Tap a shape for Guardian guidance"}
              </small>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {hazardTypes.map((type) => {
                const styles =
                  getHazardStyle(type);

                const active =
                  visibleHazards[type];

                const loaded =
                  hazardLayers.some(
                    (hazard) =>
                      hazard.type === type
                  );

                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!loaded}
                    onClick={() =>
                      toggleHazard(type)
                    }
                    style={{
                      padding: "8px 11px",
                      borderRadius: "999px",
                      border: `1px solid ${
                        active
                          ? styles.color
                          : "#d9ded6"
                      }`,
                      background: active
                        ? styles.fillColor
                        : "#f8f7f1",
                      color: active
                        ? "white"
                        : "#526159",
                      fontSize: "11px",
                      fontWeight: 700,
                      opacity: loaded ? 1 : 0.4,
                      cursor: loaded
                        ? "pointer"
                        : "not-allowed",
                    }}
                  >
                    {active ? "✓ " : ""}
                    {hazardLabels[type]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="transcript-card">
            <div className="section-heading">
              <span>Nearby resources</span>

              <small>
                {loadingResources
                  ? "Loading resources…"
                  : `${resourceMarkers.length} loaded`}
              </small>
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              {resourceKinds.map((kind) => {
                const active =
                  visibleResources[kind];

                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() =>
                      toggleResource(kind)
                    }
                    style={{
                      padding: "8px 11px",
                      borderRadius: "999px",
                      border: `1px solid ${
                        active
                          ? resourceColors[kind]
                          : "#d9ded6"
                      }`,
                      background: active
                        ? resourceColors[kind]
                        : "#f8f7f1",
                      color: active
                        ? "white"
                        : "#526159",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {active ? "✓ " : ""}
                    {resourceLabels[kind]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="safety-footer">
            Mapped public-data context only. Not a real-time emergency warning or site-specific safety determination.
          </div>
        </section>

        <aside
          className="activity-panel"
          style={{
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div className="activity-header">
            <div>
              <p className="eyebrow">
                GLENDALE GUARDIAN MAP
              </p>

              <h2>
                Hazards &amp; nearby resources
              </h2>
            </div>

            <div
              className={`status-chip ${
                loadingHazards ||
                loadingResources
                  ? "status-connecting"
                  : "status-connected"
              }`}
              style={{ margin: 0 }}
            >
              <span />
              {loadingHazards ||
              loadingResources
                ? "updating"
                : "mapped data ready"}
            </div>
          </div>

          <div
            style={{
              position: "relative",
              flex: 1,
              minHeight: "520px",
              marginTop: "22px",
              overflow: "hidden",
              border: "1px solid #d9ded6",
              borderRadius: "14px",
              background: "#eef1ec",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                zIndex: 800,
                display: "flex",
                gap: "10px",
                padding: "8px 10px",
                border: "1px solid #d9ded6",
                borderRadius: "9px",
                background:
                  "rgba(255,255,255,.94)",
                boxShadow:
                  "0 8px 24px rgba(20,42,38,.10)",
              }}
            >
              {resourceKinds.map(
                (kind) => (
                  <span
                    key={kind}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      color: "#526159",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    <i
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius:
                          "999px",
                        background:
                          resourceColors[
                            kind
                          ],
                      }}
                    />

                    {
                      resourceLabels[
                        kind
                      ]
                    }
                  </span>
                )
              )}
            </div>

            <MapContainer
              center={location}
              zoom={11}
              className="guardian-map"
              style={{
                height: "100%",
                minHeight: "520px",
                width: "100%",
              }}
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
                    : selectedProperty.address}
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

                              sendHazardToGuardian(
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
                          <div
                            className="service-card"
                            style={{
                              display:
                                "block",
                              minWidth:
                                "190px",
                              padding: "4px",
                              border: 0,
                            }}
                          >
                            <span>
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
                              <p>
                                {
                                  resource.address
                                }
                              </p>
                            )}

                            <small>
                              About{" "}
                              {Math.round(
                                resource.distance
                              )}{" "}
                              meters away
                            </small>
                          </div>
                        </Popup>
                      </CircleMarker>
                    )
                  )}
              </Pane>
            </MapContainer>
          </div>
        </aside>
      </main>

      {selectedHazard && (
        <div
          onClick={() => {
            setSelectedHazard(null);
            setAgentText("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 4000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background:
              "rgba(8,29,25,.38)",
          }}
        >
          <aside
            className="insurance-packet"
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width:
                "min(560px, 100%)",
              maxHeight:
                "calc(100vh - 48px)",
              margin: 0,
              overflowY: "auto",
              borderRadius: "18px",
            }}
          >
            <div className="packet-letterhead">
              <span className="packet-brand-symbol">
                <img
                  src="/glendale-guardian.png"
                  alt=""
                />
              </span>

              <div>
                <strong>
                  Glendale Guardian
                </strong>
                <span>
                  Mapped hazard guidance
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedHazard(
                    null
                  );
                  setAgentText("");
                }}
              >
                Close
              </button>
            </div>

            <h3>
              {selectedHazard.title}
            </h3>

            <div className="packet-summary">
              <span>
                <strong>Status</strong>
                {
                  selectedHazard.status
                }
              </span>

              <span>
                <strong>Distance</strong>
                {selectedHazard.distance ===
                0
                  ? "In mapped area"
                  : `${Math.round(
                      selectedHazard.distance
                    )} m away`}
              </span>
            </div>

            {sendingHazardContext && (
              <div className="status-chip status-connecting">
                <span />
                Guardian is reviewing this mapped context
              </div>
            )}

            <section>
              <h4>
                Guardian guidance
              </h4>

              {agentText ? (
                <div className="transcript-line agent">
                  <strong>
                    Guardian
                  </strong>
                  <p>
                    {agentText}
                  </p>
                </div>
              ) : (
                <p className="empty-state">
                  {conversation.status ===
                  "connected"
                    ? "This mapped hazard has been shared with Guardian."
                    : "Connecting this mapped hazard to Guardian."}
                </p>
              )}
            </section>

            <p className="packet-disclaimer">
              Planning context only. Not an emergency service, real-time incident alert, forecast, or site-specific safety determination.
            </p>
          </aside>
        </div>
      )}

      <BottomNav />
    </div>
  );

}

export default MapPage;
