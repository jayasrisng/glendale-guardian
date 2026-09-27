import { createServer } from "node:http";

import {
  getConversationToken,
  getFeatureGeometry,
  getMappedHazards,
  getMappedHazardsByCoordinates,
  getMappedResourcesByCoordinates,
} from "./server/guardian.mjs";

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

    if (body.length > 20_000) {
      throw new Error("Request body is too large");
    }
  }

  return body ? JSON.parse(body) : {};
}

createServer(async (request, response) => {
  try {
    if (
      request.method === "GET" &&
      request.url === "/api/health"
    ) {
      return send(response, 200, {
        ok: true,
      });
    }

    if (
      request.method === "GET" &&
      request.url === "/api/conversation-token"
    ) {
      return send(
        response,
        200,
        await getConversationToken(),
      );
    }

    const url = new URL(
      request.url,
      `http://${request.headers.host}`,
    );

    if (
      request.method === "GET" &&
      url.pathname === "/api/hazards"
    ) {
      return send(
        response,
        200,
        await getMappedHazardsByCoordinates(
          Number(url.searchParams.get("lat")),
          Number(url.searchParams.get("lon")),
        ),
      );
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/hazards"
    ) {
      const body = await readBody(request);

      return send(
        response,
        200,
        await getMappedHazards(body.address),
      );
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/feature-geometry"
    ) {
      return send(
        response,
        200,
        await getFeatureGeometry(
          url.searchParams.get("layer_url") ?? "",
          Number(url.searchParams.get("object_id")),
        ),
      );
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/resources"
    ) {
      return send(
        response,
        200,
        await getMappedResourcesByCoordinates(
          Number(url.searchParams.get("lat")),
          Number(url.searchParams.get("lon")),
          Number(url.searchParams.get("limit") ?? 2),
        ),
      );
    }

    return send(response, 404, {
      error: "Not found",
    });
  } catch (error) {
    console.error("API request failed", error);

    return send(response, 502, {
      error:
        error instanceof Error
          ? error.message
          : "Request failed",
    });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(
    `Guardian API listening on http://127.0.0.1:${port}`,
  );
});

