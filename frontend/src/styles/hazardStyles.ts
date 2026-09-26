export type HazardStyle = {
  color: string;
  fillColor: string;
};

export function getHazardStyle(type: string): HazardStyle {
  const styles: Record<string, HazardStyle> = {
    wildfire: {
      color: "#dc2626",
      fillColor: "#ef4444",
    },

    flood: {
      color: "#2563eb",
      fillColor: "#3b82f6",
    },

    fault: {
      color: "#7c3aed",
      fillColor: "#8b5cf6",
    },

    liquefaction: {
      color: "#d97706",
      fillColor: "#f59e0b",
    },

    landslide: {
      color: "#92400e",
      fillColor: "#b45309",
    },

    dam_inundation: {
      color: "#0891b2",
      fillColor: "#06b6d4",
    },

    debris_flow: {
      color: "#475569",
      fillColor: "#64748b",
    },
  };

  return (
    styles[type] ?? {
      color: "#334155",
      fillColor: "#64748b",
    }
  )
}