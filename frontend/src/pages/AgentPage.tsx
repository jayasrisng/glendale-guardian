import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Activity, ArrowRight, Check, ChevronRight, CircleAlert, FileCheck2, FileText,
  Flame, MapPin, Mic, Phone, PhoneOff, Printer, Radio, ShieldCheck,
  Square, UserRound, Waves, Zap,
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import { GUIDANCE, isApprovedAction, type GuidanceCategory } from "../config/guidance";
import { distanceMiles, LOCAL_SERVICES } from "../config/localServices";
import type { ActivityEvent, Finding, HazardContext, ResidentProfile, TranscriptEntry } from "../types/guardian";

const STORAGE_KEY = "glendale-guardian-assessment-v2";
const DEFAULT_RESIDENT: ResidentProfile = { name: "Resident", address: "", propertyType: "Residence" };

type SavedAssessment = {
  findings?: Finding[];
  insurer?: string;
  premiumRange?: string;
  resident?: ResidentProfile;
  hazards?: HazardContext | null;
};

function loadAssessment(): SavedAssessment {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}

function makeEvent(label: string, state: ActivityEvent["state"] = "info", detail?: string): ActivityEvent {
  return { id: crypto.randomUUID(), label, state, detail, timestamp: new Date().toISOString() };
}

function hazardFindings(context: HazardContext): Finding[] {
  return (Object.entries(context.categories) as [GuidanceCategory, HazardContext["categories"][GuidanceCategory]][]).map(
    ([category, item]) => ({
      id: `mapped-${category}`,
      category,
      title: `${GUIDANCE[category].title} mapped record`,
      detail: item.label,
      status: item.status === "unavailable" ? "unverified" : "verified",
      source: item.source ?? item.sources?.[0],
    }),
  );
}

function activityLabel(toolCall: unknown) {
  if (!toolCall || typeof toolCall !== "object") return "Agent tool activity received";
  const call = toolCall as Record<string, unknown>;
  return [call.tool_name ?? call.name, call.state]
    .filter(Boolean).map((value) => String(value).replaceAll("_", " ")).join(" · ");
}

function AgentPage() {
  const saved = useMemo(() => loadAssessment(), []);
  const [stage, setStage] = useState<"welcome" | "incoming" | "declined" | "review">("welcome");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>(saved.findings ?? []);
  const [hazards, setHazards] = useState<HazardContext | null>(saved.hazards ?? null);
  const [resident, setResident] = useState<ResidentProfile>(saved.resident ?? DEFAULT_RESIDENT);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"activity" | "report" | "insurance">("activity");
  const [insurer, setInsurer] = useState(saved.insurer ?? "");
  const [premiumRange, setPremiumRange] = useState(saved.premiumRange ?? "");
  const [starting, setStarting] = useState(false);
  const sentBriefing = useRef(false);

  const addEvent = useCallback((label: string, state: ActivityEvent["state"] = "info", detail?: string) => {
    setEvents((current) => [...current, makeEvent(label, state, detail)].slice(-24));
  }, []);
  const addFinding = useCallback((finding: Finding) => {
    setFindings((current) => [...current.filter((item) => item.id !== finding.id), finding]);
  }, []);

  const lookupProperty = useCallback(async (profile: ResidentProfile) => {
    addEvent("Checking City and public records", "active", profile.address);
    const response = await fetch("/api/hazards", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: profile.address }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Property record lookup failed");
    const context = body as HazardContext;
    setHazards(context);
    setFindings((current) => [...current.filter((item) => !item.id.startsWith("mapped-")), ...hazardFindings(context)]);
    addEvent("Property matched", "complete", context.location.matched_address);
    addEvent("Mapped hazard records reviewed", "complete", "CAL FIRE · FEMA · California Geological Survey");
    return context;
  }, [addEvent]);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => addEvent("Guardian call connected", "complete", `Call ${conversationId.slice(0, 8)}`),
    onDisconnect: () => addEvent("Guardian call ended", "info"),
    onError: (message) => { setError(message); addEvent("Guardian call error", "error", message); },
    onMessage: ({ message, role }) => setTranscript((current) => [...current, { id: crypto.randomUUID(), message, role }].slice(-20)),
    onMCPConnectionStatus: (status) => addEvent("City data connection", "info", activityLabel(status)),
    onMCPToolCall: (toolCall) => addEvent("City data checked", "complete", activityLabel(toolCall)),
    onAgentToolRequest: (request) => addEvent("Guardian is updating the review", "active", activityLabel(request)),
    onAgentToolResponse: (response) => addEvent("Review updated", "complete", activityLabel(response)),
    clientTools: {
      captureResidentProfile: async (parameters) => {
        const profile: ResidentProfile = {
          name: String(parameters.name ?? "Resident").trim() || "Resident",
          address: String(parameters.address ?? "").trim(),
          propertyType: String(parameters.property_type ?? "Residence").trim() || "Residence",
        };
        if (profile.address.length < 5) return "Please ask the resident for a complete Glendale property address.";
        setResident(profile);
        addEvent("Resident and property details recorded", "complete", `${profile.name} · ${profile.address}`);
        try {
          const context = await lookupProperty(profile);
          return `Profile saved and records retrieved. ${Object.entries(context.categories).map(([key, item]) => `${key}: ${item.label}. ${item.detail}`).join("\n")}`;
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "Property lookup failed";
          addEvent("Property records need another attempt", "error", message);
          return `Profile saved, but the property lookup failed: ${message}`;
        }
      },
      updateGuardianActivity: (parameters) => {
        const label = String(parameters.label ?? "Guardian activity updated");
        addEvent(label, "complete", parameters.detail ? String(parameters.detail) : undefined);
        return "Activity displayed";
      },
      recordOwnerResponse: (parameters) => {
        const rawCategory = String(parameters.category ?? "insurance");
        const category = (rawCategory in GUIDANCE ? rawCategory : "insurance") as Finding["category"];
        const title = String(parameters.title ?? "Resident statement");
        const detail = String(parameters.value ?? "Recorded during the call");
        const slug = title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
        addFinding({ id: `owner-${category}-${slug}`, category, title, detail, status: "owner_reported" });
        if (category !== "insurance") {
          addFinding({
            id: `verify-${category}-${slug}`, category, title: `${title} — verification needed`,
            detail: `The resident reported “${detail}.” Request photos, receipts, permits, or a qualified inspection before treating this as verified.`,
            status: "unverified",
          });
        }
        addEvent("Resident statement added to the report", "complete", title);
        return "Resident-reported information recorded and, where applicable, flagged for verification.";
      },
      addRecommendation: (parameters) => {
        const category = String(parameters.category ?? "");
        const actionId = String(parameters.action_id ?? "");
        if (!isApprovedAction(category, actionId)) return "Use an action ID from the approved Guardian guidance layer.";
        const action = GUIDANCE[category as GuidanceCategory].actions.find((item) => item.id === actionId)!;
        addFinding({ id: `action-${actionId}`, category: category as GuidanceCategory, title: action.title, detail: "Recommended during the Guardian review. Nearby service resources are listed in the report.", status: "action_recommended" });
        addEvent("Next step added", "complete", action.title);
        return "Approved recommendation added. Nearby service resources are visible in the report.";
      },
    },
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ findings, insurer, premiumRange, resident, hazards }));
  }, [findings, hazards, insurer, premiumRange, resident]);

  useEffect(() => {
    if (conversation.status !== "connected" || sentBriefing.current) return;
    const serviceContext = LOCAL_SERVICES.map((service) => `${service.name} (${service.category}): ${service.phone}; ${service.services}`).join("\n");
    conversation.sendContextualUpdate(
      `You are Glendale Guardian, calling from City of Glendale Resident Services for a property resilience review. Begin warmly: “Hello, I’m Glendale Guardian. I’m glad you’re taking the initiative to improve the safety of your property and organize information that may support a conversation with your insurer.” Ask for the resident’s full name, complete Glendale property address, and whether it is residential, commercial, or a restaurant. Then call captureResidentProfile. Clearly distinguish City/public records, resident-reported information, and items needing verification. If the resident claims a safety feature such as a fire-resistant roof, record it with recordOwnerResponse and explain that documentation or inspection is needed. Use only approved actions through addRecommendation. Never promise an insurance discount or call a property safe. Nearby resources:\n${serviceContext}`,
    );
    sentBriefing.current = true;
    addEvent("Guardian received the review briefing", "complete", "Ready to collect resident and property details");
  }, [addEvent, conversation]);

  const answerCall = async () => {
    setStage("review"); setStarting(true); setError(null); sentBriefing.current = false;
    addEvent("Incoming Guardian call answered", "complete");
    try {
      addEvent("Requesting microphone access", "active");
      const permissionStream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Microphone permission timed out. Allow microphone access and answer again.")), 15_000)),
      ]);
      permissionStream.getTracks().forEach((track) => track.stop());
      addEvent("Microphone ready", "complete");
      const tokenResponse = await fetch("/api/conversation-token");
      const tokenBody = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenBody.error ?? "Unable to connect the Guardian call");
      conversation.startSession({
        conversationToken: tokenBody.token, connectionType: "webrtc", userId: "glendale-resident",
        dynamicVariables: {
          user_name: resident.name === "Resident" ? "" : resident.name,
          business_name: "", property_address: resident.address, property_type: resident.propertyType,
          mapped_hazard_context: hazards ? Object.entries(hazards.categories).map(([key, value]) => `${key}: ${value.label}`).join(" | ") : "Address will be collected during the call.",
        },
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to answer the Guardian call";
      setError(message); addEvent("Guardian call could not connect", "error", message);
    } finally { setStarting(false); }
  };

  const saveInsurance = () => {
    if (insurer) addFinding({ id: "insurance-provider", category: "insurance", title: "Current insurer", detail: insurer, status: "owner_reported" });
    if (premiumRange) addFinding({ id: "insurance-premium", category: "insurance", title: "Approximate annual premium", detail: premiumRange, status: "owner_reported" });
    addEvent("Insurance context added to the packet", "complete");
  };

  const groupedFindings = useMemo(() => findings.reduce<Record<string, Finding[]>>((groups, finding) => {
    (groups[finding.status] ??= []).push(finding); return groups;
  }, {}), [findings]);
  const nearbyServices = useMemo(() => LOCAL_SERVICES
    .map((service) => ({ ...service, distance: distanceMiles(hazards?.location ?? null, service.coordinates) }))
    .toSorted((a, b) => (a.distance ?? Number.MAX_VALUE) - (b.distance ?? Number.MAX_VALUE)), [hazards]);

  if (stage === "welcome") return (
    <main className="welcome-shell">
      <div className="city-bar"><div className="brand-mark"><span className="brand-symbol"><img src="/glendale-guardian.png" alt="" /></span> City of Glendale</div><span>Resident Services</span></div>
      <section className="welcome-card resident-entry-card">
        <div className="guardian-seal"><img src="/glendale-guardian.png" alt="Glendale Guardian" /></div><p className="eyebrow">MYGLENDALE</p><h1>Welcome</h1>
        <p className="welcome-copy">Start a guided property resilience review with Glendale Guardian.</p>
        <div className="resident-service-list">
          <span><FileCheck2 size={18} /> Review available property and hazard records</span>
          <span><Mic size={18} /> Talk through safety features and open questions</span>
          <span><ShieldCheck size={18} /> Prepare a documented insurance packet</span>
        </div>
        <button className="primary-button" onClick={() => setStage("incoming")}>Continue to MyGlendale <ArrowRight size={18} /></button>
      </section>
    </main>
  );

  if (stage === "incoming" || stage === "declined") return (
    <main className="incoming-call-screen">
      <div className="call-status">{stage === "incoming" ? "Incoming call" : "Call declined"}</div>
      <div className="caller-avatar"><img src="/glendale-guardian.png" alt="Glendale Guardian" /></div><h1>Glendale Guardian</h1><p>City of Glendale Resident Services</p>
      {stage === "incoming" ? <div className="call-actions">
        <button className="call-action decline" onClick={() => setStage("declined")}><span><PhoneOff /></span>Decline</button>
        <button className="call-action answer" onClick={answerCall}><span><Phone /></span>Answer</button>
      </div> : <button className="call-back-button" onClick={() => setStage("incoming")}><Phone size={18} /> Call Guardian back</button>}
    </main>
  );

  const isConnected = conversation.status === "connected";
  const displayAddress = resident.address || "Address being collected during the call";
  return (
    <div className="guardian-app">
      <header className="app-header"><div className="brand-mark"><span className="brand-symbol"><img src="/glendale-guardian.png" alt="" /></span> Glendale Guardian</div><div className="property-pill"><MapPin size={15} /> {displayAddress}</div></header>
      <main className="dashboard-grid">
        <section className="voice-panel">
          <div className="panel-kicker"><Radio size={15} /> GUARDIAN CALL</div>
          <div className={`active-call-orb ${isConnected ? "connected" : ""}`}><img src="/glendale-guardian.png" alt="Glendale Guardian" /></div>
          <h1>{resident.name === "Resident" ? "Glendale Guardian" : resident.name}</h1>
          <p className="panel-intro">{isConnected ? "Your property resilience review is in progress." : "Connecting your resident services call."}</p>
          <div className={`status-chip status-${conversation.status}`}><span /> {starting ? "connecting" : conversation.status.replaceAll("_", " ")}</div>
          {isConnected ? <button className="end-call-button" onClick={() => conversation.endSession()}><Square size={16} fill="currentColor" /> End call</button> : null}
          <h2>{starting ? "Connecting…" : isConnected ? (conversation.isSpeaking ? "Guardian is speaking" : "Guardian is listening") : "Call ended"}</h2>
          <p className="voice-help">Guardian will ask for your name, property address, and the safety measures you know about.</p>
          {error ? <div className="error-banner"><CircleAlert size={18} /> {error}</div> : null}
          <div className="transcript-card"><div className="section-heading"><span>Call notes</span><small>Live transcript</small></div>
            {transcript.length ? <div className="transcript-list">{transcript.map((entry) => <div className={`transcript-line ${entry.role}`} key={entry.id}><strong>{entry.role === "agent" ? "Guardian" : resident.name}</strong><p>{entry.message}</p></div>)}</div> : <p className="empty-state">Guardian’s conversation notes will appear here.</p>}
          </div>
          <div className="insurance-card"><div className="section-heading"><span>Insurance details</span><small>Resident reported</small></div>
            <div className="input-row"><label>Current insurer<input value={insurer} onChange={(event) => setInsurer(event.target.value)} placeholder="Insurance company" /></label><label>Approx. annual premium<select value={premiumRange} onChange={(event) => setPremiumRange(event.target.value)}><option value="">Not provided</option><option>$1,000–$2,499</option><option>$2,500–$4,999</option><option>$5,000–$9,999</option><option>$10,000+</option></select></label></div>
            <button className="secondary-button" onClick={saveInsurance}>Add to insurance packet</button><small>The packet requests review of available mitigation benefits; it does not guarantee a premium change.</small>
          </div>
        </section>

        <aside className="activity-panel">
          <div className="activity-header"><div><p className="eyebrow">GUARDIAN REVIEW</p><h2>{view === "activity" ? "Live activity" : view === "report" ? "Property resilience report" : "Insurance packet"}</h2></div>
            <div className="view-toggle"><button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}><Activity size={16} /> Activity</button><button className={view === "report" ? "active" : ""} onClick={() => setView("report")}><FileText size={16} /> Report</button><button className={view === "insurance" ? "active" : ""} onClick={() => setView("insurance")}><FileCheck2 size={16} /> Insurance</button></div>
          </div>

          {view === "activity" ? <>
            <div className="timeline" aria-live="polite">{events.length ? events.map((event) => <div className={`timeline-event ${event.state}`} key={event.id}><div className="timeline-icon">{event.state === "complete" ? <Check size={15} /> : event.state === "error" ? <CircleAlert size={15} /> : <ChevronRight size={15} />}</div><div><strong>{event.label}</strong>{event.detail ? <span>{event.detail}</span> : null}</div></div>) : <p className="empty-state">Answer the call to begin the review.</p>}</div>
            <div className="mapped-context"><div className="section-heading"><span>City and public records</span><small>{hazards ? "Property matched" : "Waiting for address"}</small></div>
              {hazards ? <div className="hazard-list">{(Object.entries(hazards.categories) as [GuidanceCategory, HazardContext["categories"][GuidanceCategory]][]).map(([category, item]) => <article className="hazard-card" key={category}><div className={`hazard-icon ${category}`}>{category === "wildfire" ? <Flame /> : category === "flood" ? <Waves /> : <Zap />}</div><div><div className="hazard-title"><strong>{GUIDANCE[category].title}</strong><span className={`evidence-badge ${item.status}`}>Record source</span></div><p>{item.label}</p><small>{item.detail}</small>{item.source?.url ? <a href={item.source.url} target="_blank" rel="noreferrer">View {item.source.name} source</a> : null}</div></article>)}</div> : <p className="empty-state">Once Guardian records the property address, available City and authoritative public records will appear here.</p>}
            </div>
          </> : view === "report" ? <div className="report-view">
            <section className="report-identity"><div className="report-avatar"><UserRound /></div><div><h3>{resident.name}</h3><p>{displayAddress}</p><p>{resident.propertyType}</p></div></section>
            {[["verified", "City of Glendale and public records", "Information already available from connected City and authoritative public record sources."], ["owner_reported", "Resident-reported information", "Notes captured from the resident during the Guardian call."], ["unverified", "Items requiring verification", "Claims or records that need documentation, permit review, photographs, or qualified inspection."], ["action_recommended", "Recommended next steps", "Approved resilience actions identified during the review."]].map(([status, label, description]) => <section key={status}><h3>{label}</h3><small>{description}</small>{groupedFindings[status]?.length ? groupedFindings[status].map((finding) => <div className="report-finding" key={finding.id}><strong>{finding.title}</strong><p>{finding.detail}</p>{finding.source?.url ? <a href={finding.source.url} target="_blank" rel="noreferrer">Source: {finding.source.name}</a> : null}</div>) : <p className="empty-state report-empty">No items recorded yet.</p>}</section>)}
            <section><h3>Nearby safety services</h3><small>Sorted by proximity when a property match is available. Listing does not imply City endorsement; verify licensing, insurance, scope, and availability.</small><div className="service-list">{nearbyServices.map((service) => <article className="service-card" key={service.id}><div><span>{service.category}</span><strong>{service.name}</strong><p>{service.services}</p></div><div className="service-contact">{service.distance !== null ? <small>{service.distance.toFixed(1)} mi away</small> : null}<a href={`tel:${service.phone.replaceAll(/[^\d+]/g, "")}`}>{service.phone}</a><a href={service.url} target="_blank" rel="noreferrer">Website</a></div></article>)}</div></section>
          </div> : <div className="insurance-packet">
            <div className="packet-letterhead"><span className="packet-brand-symbol"><img src="/glendale-guardian.png" alt="" /></span><div><strong>Glendale Guardian</strong><span>Property Resilience Documentation</span></div><button onClick={() => window.print()}><Printer size={16} /> Print packet</button></div>
            <h3>Request for mitigation and policy review</h3><p>To the insurance representative:</p><p>{resident.name} is organizing available records and supporting documentation for the property at <strong>{displayAddress}</strong>. Please review the verified mitigation information and completed safety improvements below and advise whether any policy credits, underwriting considerations, or premium adjustments may apply.</p>
            <div className="packet-summary"><span><strong>Policyholder</strong>{resident.name}</span><span><strong>Property</strong>{resident.propertyType}</span><span><strong>Insurer</strong>{insurer || "To be provided"}</span><span><strong>Current premium</strong>{premiumRange || "Not provided"}</span></div>
            <section><h4>Verified and public-record information</h4>{groupedFindings.verified?.length ? groupedFindings.verified.map((item) => <div className="packet-item" key={item.id}><Check size={15} /><span><strong>{item.title}</strong>{item.detail}</span></div>) : <p className="empty-state">Record review is not complete.</p>}</section>
            <section><h4>Resident-reported improvements</h4>{groupedFindings.owner_reported?.filter((item) => item.category !== "insurance").length ? groupedFindings.owner_reported.filter((item) => item.category !== "insurance").map((item) => <div className="packet-item" key={item.id}><FileCheck2 size={15} /><span><strong>{item.title}</strong>{item.detail}</span></div>) : <p className="empty-state">No resident-reported improvements recorded yet.</p>}</section>
            <section><h4>Documentation still needed</h4>{groupedFindings.unverified?.length ? groupedFindings.unverified.map((item) => <div className="packet-item pending" key={item.id}><CircleAlert size={15} /><span><strong>{item.title}</strong>{item.detail}</span></div>) : <p className="empty-state">No outstanding verification items.</p>}</section>
            <p className="packet-disclaimer">This packet organizes mapped public records and resident-provided information. It is not a certification of safety, an inspection, or a guarantee of insurance eligibility or savings.</p>
          </div>}
          <div className="safety-footer"><ShieldCheck size={16} /> Planning and documentation support only. For emergencies, call 911.</div>
        </aside>
      </main><BottomNav />
    </div>
  );
}

export default AgentPage;
