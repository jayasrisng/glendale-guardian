# Glendale Guardian

Voice-first mapped resilience review prototype built on the team's React/Vite frontend.

## Local development

Requirements: Node.js 22.22 or newer and the four variables shown in `.env.example`.

```bash
npm --prefix frontend install
npm run dev
```

Open `http://127.0.0.1:5173`. The root development command starts the Vite frontend and the local server-only API used for ElevenLabs conversation tokens and authenticated GIS MCP calls.

## Checks

```bash
npm run lint
npm run build
```

## Security boundary

`ELEVENLABS_API_KEY` and `GLENDALE_GIS_MCP_SECRET` are read only by the server/API functions. They are never included in the browser bundle. `.env` files are ignored by Git.

## ElevenLabs agent configuration

The app always uses the existing agent ID; it does not create an agent. Configure the existing ElevenLabs agent with:

- Dynamic variables: `user_name`, `business_name`, `property_address`, `property_type`, and `mapped_hazard_context`.
- Optional client tools matching `updateGuardianActivity`, `recordOwnerResponse`, and `addRecommendation` in `AgentPage.tsx`.
- The authenticated Glendale GIS MCP server if you want ElevenLabs to make additional agent-directed GIS calls. The application already performs a real `hazards_at_location` call before starting the voice session and sends that context to Guardian.

Mapped data must be described as planning context—not a site-specific safety determination or current emergency information.
