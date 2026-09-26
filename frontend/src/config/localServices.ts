export type LocalService = {
  id: string;
  name: string;
  category: "Fire protection" | "Fire-resistant roofing" | "Seismic safety" | "City resource";
  services: string;
  phone: string;
  address: string;
  url: string;
  coordinates: [number, number];
};

export const LOCAL_SERVICES: LocalService[] = [
  {
    id: "glendale-fire-prevention",
    name: "Glendale Fire Prevention Bureau",
    category: "City resource",
    services: "Fire construction inspections, plan review, fire engineering, permits, and public records",
    phone: "(818) 548-4810",
    address: "780 Flower Street, Glendale, CA 91201",
    url: "https://www.glendaleca.gov/government/departments/fire-department/fire-prevention",
    coordinates: [34.1664, -118.2965],
  },
  {
    id: "glendale-vmp",
    name: "Glendale Vegetation Management Program",
    category: "City resource",
    services: "Defensible-space requirements, brush clearance, inspections, and contractor resources",
    phone: "(818) 548-3814",
    address: "780 Flower Street, Glendale, CA 91201",
    url: "https://www.glendaleca.gov/government/departments/fire-department/fire-department/vmp",
    coordinates: [34.1664, -118.2965],
  },
  {
    id: "hmo-fire-protection",
    name: "HMO Fire Protection",
    category: "Fire protection",
    services: "Fire sprinkler installation, inspection, testing, repair, and maintenance",
    phone: "(818) 638-3313",
    address: "620 Glenwood Road, Glendale, CA 91202",
    url: "https://hmofireprotection.com/",
    coordinates: [34.1649429, -118.2689494],
  },
  {
    id: "glendale-fire-systems",
    name: "Glendale Fire Systems",
    category: "Fire protection",
    services: "Fire alarm systems, testing, service, design, and construction",
    phone: "(818) 244-3473",
    address: "6657 San Fernando Road, Glendale, CA 91201",
    url: "https://www.glendalefiresystems.com/contact.htm",
    coordinates: [34.1697181, -118.2935618],
  },
  {
    id: "california-first-roofing",
    name: "California First Roofing",
    category: "Fire-resistant roofing",
    services: "Class A fire-rated roofing, ember-resistant vents, and Chapter 7A re-roofing",
    phone: "(424) 777-1619",
    address: "Serves Glendale and Los Angeles County",
    url: "https://californiafirstroofingla.com/los-angeles/cities/glendale",
    coordinates: [34.1425, -118.2551],
  },
  {
    id: "hsy-structural",
    name: "HSY Structural Engineering",
    category: "Seismic safety",
    services: "Seismic retrofit, earthquake-damage assessment, and structural fire repair",
    phone: "(818) 249-8400",
    address: "3463 Ocean View Boulevard, Glendale, CA 91208",
    url: "https://hsyinc.net/",
    coordinates: [34.2017856, -118.2283387],
  },
  {
    id: "glendale-retrofit",
    name: "Glendale Retrofit",
    category: "Seismic safety",
    services: "Design-build soft-story retrofits for residential and commercial properties",
    phone: "(818) 915-0037",
    address: "Serves Glendale and the Los Angeles area",
    url: "https://glendaleretrofit.com/",
    coordinates: [34.1808, -118.3089],
  },
  {
    id: "structural-af",
    name: "Structural AF",
    category: "Seismic safety",
    services: "Structural evaluation, residential and commercial engineering, and soft-story retrofit design",
    phone: "(747) 609-1071",
    address: "1021 South Brand Boulevard, Suite 101, Glendale, CA 91204",
    url: "https://www.structuralaf.com/",
    coordinates: [34.1342018, -118.2550884],
  },
  {
    id: "one-stop-retrofit",
    name: "One Stop Retrofit",
    category: "Seismic safety",
    services: "Earthquake retrofit, soft-story work, inspection, engineering, and construction",
    phone: "(818) 457-5730",
    address: "377 West Wilson Avenue, Glendale, CA 91203",
    url: "https://onestopretrofit.com/glendale/",
    coordinates: [34.1481014, -118.2606259],
  },
  {
    id: "universal-builders",
    name: "Universal Builders",
    category: "Seismic safety",
    services: "Foundation repair, stabilization, structural repair, and residential or commercial retrofits",
    phone: "(877) 794-2494",
    address: "344 Mira Loma Avenue, Unit 100, Glendale, CA 91204",
    url: "https://universalbuildersco.com/retrofit-foundation/",
    coordinates: [34.1237976, -118.2567813],
  },
];

export function distanceMiles(
  from: { lat: number; lon: number } | null,
  to: [number, number],
) {
  if (!from) return null;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const latitudeDelta = radians(to[0] - from.lat);
  const longitudeDelta = radians(to[1] - from.lon);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.lat)) * Math.cos(radians(to[0])) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
