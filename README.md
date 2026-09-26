# Glendale Guardian

Voice-first mapped resilience review for City of Glendale Resident Services.

## Why we built it

Glendale Guardian began with a simple question: what if preparing a home for the next fire, flood, or earthquake felt less like doing paperwork and more like getting a helpful call from a neighbor who knows where to look?

Built for **Jewel City Hacks 5.0 — Hackathon 2026**, Guardian turns a resident conversation into useful momentum. A friendly voice guide asks about the property, checks available public hazard records, keeps resident-reported improvements separate from verified information, identifies what still needs documentation, and creates an insurance-ready summary. It also connects the resident with nearby safety professionals who can help turn recommendations into real work.

### Three groups, one stronger Glendale

- **Residents get clarity.** Instead of bouncing among maps, phone numbers, technical reports, and insurance forms, they get one guided conversation, a readable property review, and practical next steps.
- **Glendale IT gets a bridge to public data.** Guardian demonstrates how existing GIS and public-service information can become an approachable resident experience without pretending that mapped records are inspections or safety guarantees.
- **Local businesses get discovered at the right moment.** Roofers, defensible-space teams, fire-protection specialists, and seismic professionals appear when residents are ready to act—while the app clearly asks users to verify licensing, insurance, scope, and availability.

### How we built it

The experience is a React and TypeScript app developed with Vite and published through **Vercel**. **ElevenLabs** powers the conversational Guardian agent. **Leaflet**, OpenStreetMap tiles, Glendale GIS data, and authoritative public hazard sources bring the map and property context to life. A server-side API keeps service credentials away from the browser, while the interface labels City/public records, owner-reported details, unverified claims, and recommended actions as distinct kinds of evidence.

The result is intentionally optimistic: civic technology can feel warm, local, and even a little playful while still being careful about evidence. Guardian does not replace inspectors, emergency services, insurers, or qualified contractors. It helps people take the next responsible step—and gives the whole resilience ecosystem a better place to begin.

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
- Client tool `captureResidentProfile` with string parameters `name`, `address`, and `property_type`. Guardian should call it after asking the resident for those details; it triggers the property-record lookup.
- Client tools matching `updateGuardianActivity`, `recordOwnerResponse`, and `addRecommendation` in `AgentPage.tsx`.
- The authenticated Glendale GIS MCP server if you want ElevenLabs to make additional agent-directed GIS calls. The application already performs a real `hazards_at_location` call before starting the voice session and sends that context to Guardian.

Mapped data must be described as planning context—not a site-specific safety determination or current emergency information.

The opening call script and behavior briefing are also sent from the browser after the call connects. For the most reliable first spoken message, configure the ElevenLabs agent to greet the resident, ask for their full name and complete Glendale property address, and then call `captureResidentProfile`.

## Local service directory

`frontend/src/config/localServices.ts` contains a curated set of public Glendale-area City and business resources for fire protection, fire-resistant roofing, defensible space, and seismic work. Entries include their public phone, address or service area, website, and coordinates for proximity sorting. Listings are informational and do not imply City endorsement; licensing, insurance, scope, and availability should be verified before engagement.
