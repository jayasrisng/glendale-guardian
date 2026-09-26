export const DEMO_PROFILE = {
  id: "demo-guardian-restaurant",
  name: "Demo Glendale Business Owner",
  businessName: "Guardian Demo Restaurant",
  propertyType: "Commercial / Restaurant",
  address: "2527 Canada Blvd, Glendale, CA 91208",
} as const;

export type DemoProfile = typeof DEMO_PROFILE;
