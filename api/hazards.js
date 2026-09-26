import {
  getMappedHazards,
  getMappedHazardsByCoordinates,
} from "../server/guardian.mjs";

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (request.method === "GET") {
      return response.status(200).json(
        await getMappedHazardsByCoordinates(
          Number(request.query?.lat),
          Number(request.query?.lon),
        ),
      );
    }
    return response.status(200).json(await getMappedHazards(request.body?.address));
  } catch (error) {
    console.error("Mapped hazard lookup error", error);
    return response.status(502).json({ error: "Unable to retrieve mapped hazard context" });
  }
}
