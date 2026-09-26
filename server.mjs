import { createServer } from "node:http";
import { getConversationToken, getMappedHazards } from "./server/guardian.mjs";

const port = Number(process.env.API_PORT ?? 8787);

function send(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 20_000) throw new Error("Request body is too large");
  }
  return body ? JSON.parse(body) : {};
}

createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/api/health") {
      return send(response, 200, { ok: true });
    }
    if (request.method === "GET" && request.url === "/api/conversation-token") {
      return send(response, 200, await getConversationToken());
    }
    if (request.method === "POST" && request.url === "/api/hazards") {
      const body = await readBody(request);
      return send(response, 200, await getMappedHazards(body.address));
    }
    return send(response, 404, { error: "Not found" });
  } catch (error) {
    console.error("API request failed", error);
    return send(response, 502, { error: error.message ?? "Request failed" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Guardian API listening on http://127.0.0.1:${port}`);
});
