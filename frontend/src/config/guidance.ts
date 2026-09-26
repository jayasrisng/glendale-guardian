export type GuidanceCategory = "wildfire" | "flood" | "seismic";

export type GuidanceEntry = {
  title: string;
  approvedQuestions: string[];
  actions: { id: string; title: string }[];
  disclaimer: string;
  source: { agency: string; url: string };
};

export const GUIDANCE: Record<GuidanceCategory, GuidanceEntry> = {
  wildfire: {
    title: "Wildfire",
    approvedQuestions: [
      "Do you know whether exterior vents are designed to resist ember entry?",
      "When was vegetation and combustible material nearest the building last reviewed?",
    ],
    actions: [
      { id: "WF-VENT-REVIEW", title: "Arrange an ember-entry and vent review" },
      { id: "WF-SPACE-REVIEW", title: "Review defensible-space guidance" },
    ],
    disclaimer:
      "Mapped fire hazard severity describes long-term landscape conditions, not current fire activity or the safety of a specific building.",
    source: { agency: "CAL FIRE", url: "https://osfm.fire.ca.gov/what-we-do/community-wildfire-preparedness-and-mitigation/fire-hazard-severity-zones" },
  },
  flood: {
    title: "Flood",
    approvedQuestions: [
      "Do you know whether water has entered the property during previous heavy rain?",
      "Are important records, electrical equipment, or inventory stored directly on the floor?",
    ],
    actions: [
      { id: "FL-HISTORY-REVIEW", title: "Document known water-entry history" },
      { id: "FL-STORAGE-REVIEW", title: "Review vulnerable equipment and storage" },
    ],
    disclaimer:
      "FEMA flood maps are planning and insurance maps. Conditions outside mapped special flood hazard areas can still flood.",
    source: { agency: "FEMA", url: "https://www.fema.gov/flood-maps" },
  },
  seismic: {
    title: "Seismic",
    approvedQuestions: [
      "Are tall shelves, appliances, and other heavy equipment anchored or restrained?",
      "Has a qualified professional evaluated the building or nonstructural equipment for seismic concerns?",
    ],
    actions: [
      { id: "EQ-EQUIPMENT-REVIEW", title: "Review anchoring of heavy equipment" },
      { id: "EQ-PRO-ASSESSMENT", title: "Consider a qualified seismic assessment" },
    ],
    disclaimer:
      "Mapped seismic zones are not site-specific engineering conclusions. All of Glendale can experience earthquake shaking.",
    source: { agency: "California Geological Survey", url: "https://www.conservation.ca.gov/cgs/sh" },
  },
};

export function isApprovedAction(category: string, actionId: string) {
  if (!(category in GUIDANCE)) return false;
  return GUIDANCE[category as GuidanceCategory].actions.some(
    (action) => action.id === actionId,
  );
}
