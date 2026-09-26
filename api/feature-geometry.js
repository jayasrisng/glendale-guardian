import { getFeatureGeometry } from "../server/guardian.mjs";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    return response.status(200).json(
      await getFeatureGeometry(
        String(request.query?.layer_url ?? ""),
        Number(request.query?.object_id),
      ),
    );
  } catch (error) {
    console.error("Feature geometry error", error);
    return response.status(502).json({ error: "Unable to retrieve GIS geometry" });
  }
}
