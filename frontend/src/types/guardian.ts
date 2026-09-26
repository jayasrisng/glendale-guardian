import type { GuidanceCategory } from "../config/guidance";

export type FindingStatus =
  | "verified"
  | "owner_reported"
  | "unverified"
  | "action_recommended"
  | "not_applicable";

export type Finding = {
  id: string;
  category: GuidanceCategory | "insurance";
  title: string;
  detail: string;
  status: FindingStatus;
  source?: { name: string; url?: string; asOf?: string };
};

export type ActivityEvent = {
  id: string;
  state: "active" | "complete" | "info" | "error";
  label: string;
  detail?: string;
  timestamp: string;
};

export type HazardCategory = {
  status: "in_zone" | "not_in_zone" | "unavailable";
  label: string;
  detail: string;
  disclaimer?: string;
  source?: { name: string; url?: string; asOf?: string };
  sources?: { name: string; url?: string; asOf?: string }[];
};

export type HazardContext = {
  location: {
    lat: number;
    lon: number;
    matched_address: string;
    score: number;
  };
  categories: Record<GuidanceCategory, HazardCategory>;
};

export type TranscriptEntry = {
  id: string;
  role: "user" | "agent";
  message: string;
};
