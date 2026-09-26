import { getConversationToken } from "../server/guardian.mjs";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }

  try {
    return response.status(200).json(await getConversationToken());
  } catch (error) {
    console.error("Conversation token error", error);
    return response.status(502).json({ error: "Unable to start the voice session" });
  }
}
