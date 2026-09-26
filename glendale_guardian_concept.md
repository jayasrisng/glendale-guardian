# Glendale Guardian

## Concept

**Glendale Guardian is a proactive, voice-first safety and resilience
assistant for Glendale residents and businesses.**

The City already has valuable information about properties and
neighborhoods through GIS data, hazard maps, permits, inspections, and
other public records. Residents and business owners hold another part of
the picture: what safety measures actually exist on their property
today. https://glendale-gis-mcp-1053589358088.us-west2.run.app/mcp

Glendale Guardian connects those two sources through a natural voice
conversation.

Instead of requiring a resident or business owner to understand GIS
layers, navigate multiple City websites, interpret safety guidance,
contact different departments, and independently find contractors, the
user can simply ask:

> **"Guardian, what do I need to do to make my property safer?"**

Guardian uses available City and public data to understand the property,
talks with the user to fill in missing information, identifies relevant
safety gaps, recommends next steps, connects the user with appropriate
local services, and produces a documented resilience report that may
also help the user discuss mitigation-related insurance benefits with
their insurer.

------------------------------------------------------------------------

## The Problem

Property safety information is fragmented.

A resident or business owner may need to separately determine:

-   Which hazards affect their property
-   Which safety measures are relevant to those hazards
-   Which protections or permits are already documented
-   What still needs to be inspected or improved
-   Which City department or resource applies
-   Which local professional can perform the work
-   What documentation should be retained
-   Whether completed mitigation could affect their insurance

At the same time, the City may already possess useful geographic and
property information that could eliminate many unnecessary questions.

Glendale Guardian turns this fragmented process into one guided
conversation.

------------------------------------------------------------------------

## User Experience

### 1. Sign in

The user enters a MyGlendale-style portal.

For the prototype, the user can sign in with Google/Gmail and create a
simple property profile containing information such as:

-   Name
-   Email
-   Property address
-   Residential or commercial property
-   Business name, when applicable

The prototype can use a preconfigured demonstration property.

Once the user signs in, Guardian already knows which property is being
reviewed.

------------------------------------------------------------------------

## 2. Start a Guardian Review

The user selects:

**Ask Guardian**

An ElevenLabs-powered voice conversation begins.

Guardian might say:

> "Hi, I'm Glendale Guardian. I can help you understand the safety and
> resilience considerations for your property. I'll first check the
> information available for your location so I don't ask you questions
> Glendale may already be able to answer."

------------------------------------------------------------------------

## 3. Understand the Property

Guardian uses the property address to query available location and
hazard information, including the Glendale GIS MCP server.

Depending on the data available for that location, Guardian can
investigate relevant hazards such as:

-   Wildfire
-   Flooding
-   Earthquake/seismic risk
-   Other hazards represented by available Glendale GIS datasets

The important principle is that Guardian does **not** give every
property the same checklist.

The property determines the conversation.

For example:

> "I checked the available information for your property. Wildfire does
> not appear to be the primary concern here, but there are flood and
> seismic considerations worth reviewing."

Guardian then focuses the conversation on those relevant areas.

------------------------------------------------------------------------

## 4. Combine City Data With Owner Knowledge

Guardian builds the assessment from multiple evidence levels.

### Verified

Information confirmed through an authoritative City/public record or
connected data source.

### Owner Reported

Information supplied by the resident or business owner but not
independently verified.

### Unverified

Information Guardian cannot determine from the available data or
conversation.

### Action Recommended

A potential safety or resilience gap requiring investigation,
remediation, inspection, or another next step.

### Not Applicable

An item that is not relevant to the property's identified risk profile.

This distinction prevents Guardian from presenting self-reported
information as an official City verification.

------------------------------------------------------------------------

## 5. Have a Natural Safety Conversation

Guardian asks only the questions necessary to complete the property's
assessment.

For example:

> "I found information indicating that a sprinkler permit exists for
> this property. Do you know when the system was last inspected?"

Or:

> "The available geographic information indicates that seismic
> preparedness is relevant here. Are large appliances, shelving, or
> other heavy equipment anchored?"

The conversation fills the gaps between what the City/public data
already knows and what is happening at the property today.

------------------------------------------------------------------------

## 6. Understand the User's Insurance Context

Guardian also asks the user about their current property or business
insurance.

For example:

> "Who is your current insurer?"

> "Approximately how much are you currently paying for coverage?"

This information becomes part of the user's Guardian profile and final
report.

Guardian does **not** promise that a particular improvement will
automatically reduce the user's premium.

Instead, Guardian can explain that once relevant mitigation work is
completed and appropriately documented, the resulting evidence may help
the user discuss applicable mitigation credits, discounts, underwriting
considerations, or premium changes with their insurer.

For example:

> "Once these recommended items are completed and appropriately
> verified, I can organize the supporting documentation into your
> Guardian report. You can use that documentation when speaking with
> your insurer about whether any mitigation-related insurance benefits
> apply to your policy."

The long-term vision could allow Guardian to help package or transmit
this documentation to participating insurers, with the user's
authorization.

The workflow is therefore:

**Safer property → completed mitigation → documented evidence → insurer
conversation → potential insurance benefit**

Insurance savings are an incentive and potential outcome, not a
guarantee made by Guardian or the City.

------------------------------------------------------------------------

## 7. Turn Findings Into Actions

Guardian should not stop after identifying a problem.

If the assessment identifies a relevant action, Guardian helps the user
understand what to do next.

For example:

**Identified gap:** Seismic inspection recommended

Guardian can then surface relevant Glendale-area professionals or
businesses capable of performing that service.

Possible service categories include:

-   Fire safety inspection
-   Fire sprinkler installation or inspection
-   Seismic assessment or retrofit
-   Flood mitigation
-   Property inspection
-   Other hazard-specific services

For the hackathon prototype, this service directory can be a small
curated dataset rather than a complete marketplace.

This creates a local economic loop:

**Safety need → local service → work completed → safer Glendale
property**

------------------------------------------------------------------------

## 8. Guardian Safety Report

At the end of the conversation, Guardian generates a structured
**Guardian Safety Report** or **Property Resilience Report**.

The report can contain:

### Property

-   User/business
-   Property address
-   Property type

### Location Context

-   Relevant hazards identified from available geographic data
-   Data sources consulted

### Verified Protections

Safety information supported by available authoritative records.

### Owner-Reported Protections

Safety measures reported during the Guardian conversation.

### Unverified Items

Information requiring additional evidence or inspection.

### Recommended Actions

Prioritized next steps based on the assessment.

### Local Resources

Relevant City resources and local service providers.

### Insurance Context

-   User's insurer
-   Current approximate insurance cost, if voluntarily provided
-   Completed/remaining mitigation documentation
-   Materials the user may take to their insurer

Guardian can make the report available through the dashboard and
optionally send it by email.

------------------------------------------------------------------------

## 9. Closing the Loop

The long-term Glendale Guardian experience extends beyond the initial
conversation.

A recommended future workflow is:

``` text
MyGlendale
    ↓
Property Profile
    ↓
Glendale GIS + Available City/Public Data
    ↓
Relevant Hazard Context
    ↓
ElevenLabs Guardian Conversation
    ↓
Verified + Owner-Reported + Unverified Information
    ↓
Safety / Resilience Assessment
    ↓
Recommended Actions
    ↓
Local Service Providers
    ↓
Work Completed
    ↓
Professional / City Verification Where Applicable
    ↓
Updated Guardian Safety Report
    ↓
Documented Mitigation Evidence
    ↓
Insurance Discussion
    ↓
Potential Insurance Benefit
```

------------------------------------------------------------------------

## Stakeholder Value

### Residents and Business Owners

Guardian makes safety information easier to understand and act upon.

Users receive:

-   A property-specific assessment
-   Fewer unnecessary questions
-   Clear explanations instead of government terminology
-   Prioritized actions
-   Relevant local resources
-   Documentation of mitigation efforts
-   A clearer evidence package for conversations with insurers

### City of Glendale

Guardian can make existing City information substantially more
accessible.

Potential benefits include:

-   Better-informed residents and businesses
-   Improved safety and resilience
-   Easier navigation of City information
-   Reduced repetitive information requests
-   Better pathways from identified hazards to remediation
-   Greater visibility into where users encounter information or
    compliance gaps

### Local Businesses

Guardian can connect identified property needs with relevant local
professionals.

That creates qualified demand for services such as inspections,
retrofits, installations, and mitigation work while keeping more
economic activity within the local community.

### Insurers

Where appropriate integrations and agreements exist, Guardian could
eventually provide structured evidence of completed mitigation and
verification, making it easier to evaluate relevant property resilience
measures.

------------------------------------------------------------------------

## Prototype

The hackathon prototype does not need to implement the entire future
ecosystem.

The prototype should demonstrate one complete user journey:

1.  User signs into a mock MyGlendale account.
2.  A property profile is loaded.
3.  User selects **Ask Guardian**.
4.  ElevenLabs starts a natural voice conversation.
5.  Guardian queries the Glendale GIS MCP server and other configured
    sources.
6.  Guardian identifies which hazards are relevant to the property.
7.  Guardian asks targeted questions to fill information gaps.
8.  Guardian asks about the user's insurer and approximate current
    insurance cost.
9.  The assessment updates as the conversation progresses.
10. Guardian identifies one or more recommended actions.
11. Relevant local services/resources are surfaced.
12. Guardian generates a Guardian Safety Report.
13. The dashboard displays the report and its evidence classifications.
14. The report explains how completed and verified mitigation can be
    documented for a future insurer conversation.

------------------------------------------------------------------------

## Demo Experience

The hackathon demonstration uses a split-screen experience.

### User Side

The left side shows the resident or business owner speaking naturally
with Glendale Guardian through ElevenLabs.

### Guardian Side

The right side shows what Guardian is doing at the system level without
exposing hidden model reasoning.

For example:

``` text
GLENDALE GUARDIAN — LIVE ACTIVITY

Property profile loaded

→ Querying Glendale GIS MCP
✓ Geographic context retrieved

→ Checking hazard information
Wildfire: [result]
Flood: [result]
Seismic: [result]

→ Reviewing available property information
✓ Existing record found
? Inspection status unavailable

→ Asking owner for missing information

→ Updating Guardian assessment

→ Finding relevant local resources

✓ Guardian Safety Report ready
```

As the conversation happens, the user's dashboard updates with:

-   Verified information
-   Owner-reported information
-   Unverified information
-   Recommended actions
-   Relevant local services
-   Insurance documentation status

This makes the intelligence behind the voice conversation visible to
judges.

------------------------------------------------------------------------

## Technology Concept

``` text
                 MYGLENDALE-STYLE APP
                    Vercel Deployment
                           │
                 Google/Gmail Sign-In
                           │
                    Property Profile
                           │
                           ▼
                  GLENDALE GUARDIAN
                           │
                  ElevenLabs Voice AI
                           │
                           ▼
                    Tool / MCP Layer
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
    Glendale GIS      Property/City     Guardian Data
       MCP               Sources            Tools
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
                  Guardian Assessment
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Dashboard      Report      Local Services
                           │
                           ▼
                 Insurance Evidence
```

Vercel hosts the web application, dashboard, API/backend functions, and
any required application state.

ElevenLabs provides the conversational voice-agent experience.

The Glendale GIS MCP server supplies available geographic context.

Additional prototype tools can provide property information, safety
guidance, local-service data, report generation, and other structured
information required by Guardian.

------------------------------------------------------------------------

## Core Guardian Principles

Guardian should:

1.  Use available authoritative information before asking the user.
2.  Ask only questions relevant to the specific property.
3.  Clearly distinguish verified information from self-reported
    information.
4.  Never invent City records, permits, inspections, requirements, fees,
    or regulations.
5.  Never represent an unverified property as officially compliant.
6.  Never guarantee insurance discounts or premium reductions.
7.  Explain uncertainty when information cannot be verified.
8.  Prefer connected official sources over general model knowledge.
9.  Ask one clear question at a time.
10. Turn identified problems into concrete next steps.

------------------------------------------------------------------------

## Core Product Insight

The City already possesses valuable information about its geography and
properties.

Residents and businesses possess information about what actually exists
at their properties.

**Glendale Guardian connects those two sources through conversation.**

Instead of forcing users to understand GIS maps, government terminology,
department structures, safety regulations, contractors, documentation,
and insurance mitigation processes independently, Guardian translates
that complexity into one question:

> **"What do I need to do to make my property safer?"**

Guardian then turns the answer into action.

------------------------------------------------------------------------

## One-Line Pitch

> **Glendale Guardian turns City data into a conversation, the
> conversation into action, and completed safety improvements into
> documented resilience.**

## Demo Pitch

> **Today, a safety notice leaves a resident or business owner figuring
> out what applies to their property, what the City already knows, who
> can fix the problem, and how to document it. Glendale Guardian turns
> that fragmented process into one personalized conversation.**
