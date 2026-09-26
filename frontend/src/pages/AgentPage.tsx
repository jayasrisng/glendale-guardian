import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  Flame,
  Landmark,
  MapPin,
  Mic,
  Radio,
  ShieldCheck,
  Square,
  Waves,
  Zap,
} from "lucide-react";
import BottomNav from "../components/BottomNav";
import { DEMO_PROFILE } from "../config/demoProfile";
import { GUIDANCE, isApprovedAction, type GuidanceCategory } from "../config/guidance";
import type { ActivityEvent, Finding, HazardContext, TranscriptEntry } from "../types/guardian";

const STORAGE_KEY = "glendale-guardian-assessment-v1";

function makeEvent(label: string, state: ActivityEvent["state"] = "info", detail?: string): ActivityEvent {
  return { id: crypto.randomUUID(), label, state, detail, timestamp: new Date().toISOString() };
}

function hazardFindings(context: HazardContext): Finding[] {
  return (Object.entries(context.categories) as [GuidanceCategory, HazardContext["categories"][GuidanceCategory]][]).map(
    ([category, item]) => ({
      id: `mapped-${category}`,
      category,
      title: `${GUIDANCE[category].title} mapped context`,
      detail: item.label,
      status: item.status === "unavailable" ? "unverified" : "verified",
      source: item.source ?? item.sources?.[0],
    }),
  );
}

function activityLabel(toolCall: unknown) {
  if (!toolCall || typeof toolCall !== "object") return "Agent tool activity received";
  const call = toolCall as Record<string, unknown>;
  const name = call.tool_name ?? call.name;
  const state = call.state;
  return [name ? String(name) : "Agent tool", state ? String(state).replaceAll("_", " ") : ""]
    .filter(Boolean)
    .join(" · ");
}

function AgentPage() {
  const [entered, setEntered] = useState(false);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [findings, setFindings] = useState<Finding[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved).findings ?? []) : [];
    } catch {
      return [];
    }
  });
  const [hazards, setHazards] = useState<HazardContext | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"activity" | "report">("activity");
  const [insurer, setInsurer] = useState("");
  const [premiumRange, setPremiumRange] = useState("");
  const [starting, setStarting] = useState(false);
  const sentContext = useRef(false);

  const addEvent = useCallback((label: string, state: ActivityEvent["state"] = "info", detail?: string) => {
    setEvents((current) => [...current, makeEvent(label, state, detail)].slice(-18));
  }, []);

  const addFinding = useCallback((finding: Finding) => {
    setFindings((current) => [...current.filter((item) => item.id !== finding.id), finding]);
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      addEvent("Voice session connected", "complete", `Session ${conversationId.slice(0, 8)}`);
    },
    onDisconnect: () => addEvent("Voice session ended", "info"),
    onError: (message) => {
      setError(message);
      addEvent("Voice session error", "error", message);
    },
    onMessage: ({ message, role }) => {
      setTranscript((current) => [...current, { id: crypto.randomUUID(), message, role }].slice(-12));
    },
    onMCPConnectionStatus: (status) => addEvent("ElevenLabs MCP connection status", "info", activityLabel(status)),
    onMCPToolCall: (toolCall) => addEvent("ElevenLabs MCP tool activity", "complete", activityLabel(toolCall)),
    onAgentToolRequest: (request) => addEvent("Guardian requested a tool", "active", activityLabel(request)),
    onAgentToolResponse: (response) => addEvent("Guardian received a tool response", "complete", activityLabel(response)),
    clientTools: {
      updateGuardianActivity: (parameters) => {
        const label = String(parameters.label ?? "Guardian activity updated");
        addEvent(label, "complete", parameters.detail ? String(parameters.detail) : undefined);
        return "Activity displayed";
      },
      recordOwnerResponse: (parameters) => {
        const category = String(parameters.category ?? "insurance") as Finding["category"];
        const title = String(parameters.title ?? "Owner response");
        const detail = String(parameters.value ?? "Recorded during conversation");
        addFinding({
          id: `owner-${category}-${title.toLowerCase().replaceAll(" ", "-")}`,
          category,
          title,
          detail,
          status: "owner_reported",
        });
        addEvent("Owner response recorded", "complete", title);
        return "Owner-reported response recorded";
      },
      addRecommendation: (parameters) => {
        const category = String(parameters.category ?? "");
        const actionId = String(parameters.action_id ?? "");
        if (!isApprovedAction(category, actionId)) {
          addEvent("Unapproved recommendation rejected", "error", actionId);
          return "Rejected: use an action ID from the approved Guardian guidance layer";
        }
        const action = GUIDANCE[category as GuidanceCategory].actions.find((item) => item.id === actionId)!;
        addFinding({
          id: `action-${actionId}`,
          category: category as GuidanceCategory,
          title: action.title,
          detail: "Suggested from the approved Guardian prototype guidance layer.",
          status: "action_recommended",
        });
        addEvent("Recommendation added", "complete", action.title);
        return "Approved recommendation added";
      },
    },
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ findings, insurer, premiumRange }));
  }, [findings, insurer, premiumRange]);

  useEffect(() => {
    if (conversation.status !== "connected" || !hazards || sentContext.current) return;
    const mappedContext = Object.entries(hazards.categories)
      .map(([category, item]) => `${category}: ${item.label}. ${item.detail}`)
      .join("\n");
    conversation.sendContextualUpdate(
      `The signed-in property is ${DEMO_PROFILE.address}. The application completed an authenticated Glendale GIS MCP hazards_at_location lookup. Mapped hazard context:\n${mappedContext}\nUse this as mapped public-data context only. Do not call the property safe or unsafe.`,
    );
    sentContext.current = true;
    addEvent("Mapped context sent to Guardian", "complete");
  }, [addEvent, conversation, hazards]);

  const startGuardian = async () => {
    setStarting(true);
    setError(null);
    sentContext.current = false;
    try {
      addEvent("Querying Glendale GIS", "active", "hazards_at_location");
      const hazardResponse = await fetch("/api/hazards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: DEMO_PROFILE.address }),
      });
      const hazardBody = await hazardResponse.json();
      if (!hazardResponse.ok) throw new Error(hazardBody.error ?? "GIS lookup failed");
      setHazards(hazardBody);
      setFindings((current) => [
        ...current.filter((item) => !item.id.startsWith("mapped-")),
        ...hazardFindings(hazardBody),
      ]);
      addEvent("GIS response received", "complete", hazardBody.location.matched_address);

      addEvent("Requesting microphone access", "active");
      const permissionStream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Microphone permission timed out. Allow microphone access and try again.")), 15_000);
        }),
      ]);
      permissionStream.getTracks().forEach((track) => track.stop());
      addEvent("Microphone ready", "complete");

      addEvent("Connecting to Glendale Guardian", "active");
      const tokenResponse = await fetch("/api/conversation-token");
      const tokenBody = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenBody.error ?? "Unable to obtain conversation token");

      conversation.startSession({
        conversationToken: tokenBody.token,
        connectionType: "webrtc",
        userId: DEMO_PROFILE.id,
        dynamicVariables: {
          user_name: DEMO_PROFILE.name,
          business_name: DEMO_PROFILE.businessName,
          property_address: DEMO_PROFILE.address,
          property_type: DEMO_PROFILE.propertyType,
          mapped_hazard_context: Object.entries(hazardBody.categories)
            .map(([category, item]) => `${category}: ${(item as { label: string }).label}`)
            .join(" | "),
        },
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to start Guardian";
      setError(message);
      addEvent("Guardian could not start", "error", message);
    } finally {
      setStarting(false);
    }
  };

  const saveInsurance = () => {
    if (insurer) addFinding({ id: "insurance-provider", category: "insurance", title: "Current insurer", detail: insurer, status: "owner_reported" });
    if (premiumRange) addFinding({ id: "insurance-premium", category: "insurance", title: "Approximate premium range", detail: premiumRange, status: "owner_reported" });
    addEvent("Optional insurance context saved", "complete");
  };

  const groupedFindings = useMemo(() => findings.reduce<Record<string, Finding[]>>((groups, finding) => {
    (groups[finding.status] ??= []).push(finding);
    return groups;
  }, {}), [findings]);

  if (!entered) {
    return (
      <main className="welcome-shell">
        <div className="city-bar">
          <div className="brand-mark"><Landmark size={22} /> City of Glendale</div>
          <span>Prototype resident services</span>
        </div>
        <section className="welcome-card">
          <div className="guardian-seal"><ShieldCheck size={36} /></div>
          <p className="eyebrow">MYGLENDALE</p>
          <h1>Welcome back</h1>
          <p className="welcome-copy">Continue with the demonstration property to begin a mapped resilience review.</p>
          <div className="profile-card">
            <div className="profile-icon"><Building2 /></div>
            <div>
              <strong>{DEMO_PROFILE.name}</strong>
              <span>{DEMO_PROFILE.businessName}</span>
              <span><MapPin size={14} /> {DEMO_PROFILE.address}</span>
              <small>{DEMO_PROFILE.propertyType}</small>
            </div>
          </div>
          <button className="primary-button" onClick={() => {
            setEntered(true);
            addEvent("Property profile loaded", "complete", DEMO_PROFILE.address);
          }}>
            Continue to MyGlendale <ArrowRight size={18} />
          </button>
          <p className="prototype-note">Demo profile only · No production authentication</p>
        </section>
      </main>
    );
  }

  const isConnected = conversation.status === "connected";

  return (
    <div className="guardian-app">
      <header className="app-header">
        <div className="brand-mark"><ShieldCheck size={24} /> Glendale Guardian</div>
        <div className="property-pill"><MapPin size={15} /> {DEMO_PROFILE.address}</div>
      </header>

      <main className="dashboard-grid">
        <section className="voice-panel">
          <div className="panel-kicker"><Radio size={15} /> VOICE REVIEW</div>
          <h1>Ask Guardian</h1>
          <p className="panel-intro">Talk naturally about your property. Guardian uses mapped public data and clearly labels what you report.</p>
          <div className={`status-chip status-${conversation.status}`}><span /> {conversation.status.replaceAll("_", " ")}</div>
          <button
            className={`voice-button ${isConnected ? "live" : ""}`}
            onClick={isConnected ? () => conversation.endSession() : startGuardian}
            disabled={starting || conversation.status === "connecting"}
            aria-label={isConnected ? "End Guardian conversation" : "Ask Guardian"}
          >
            {isConnected ? <Square size={42} fill="currentColor" /> : <Mic size={56} />}
          </button>
          <h2>{starting ? "Preparing your review…" : isConnected ? (conversation.isSpeaking ? "Guardian is speaking" : "Guardian is listening") : "Tap to speak"}</h2>
          <p className="voice-help">{isConnected ? "Your mapped property context has been shared with Guardian." : "Your browser will ask for microphone permission."}</p>
          {error ? <div className="error-banner"><CircleAlert size={18} /> {error}</div> : null}

          <div className="transcript-card">
            <div className="section-heading"><span>Conversation</span><small>Live transcript</small></div>
            {transcript.length ? <div className="transcript-list">{transcript.map((entry) => (
              <div className={`transcript-line ${entry.role}`} key={entry.id}><strong>{entry.role === "agent" ? "Guardian" : "You"}</strong><p>{entry.message}</p></div>
            ))}</div> : <p className="empty-state">Transcript will appear after the conversation begins.</p>}
          </div>

          <div className="insurance-card">
            <div className="section-heading"><span>Optional insurance context</span><small>Owner reported</small></div>
            <div className="input-row">
              <label>Insurer<input value={insurer} onChange={(event) => setInsurer(event.target.value)} placeholder="Optional" /></label>
              <label>Approx. annual premium<select value={premiumRange} onChange={(event) => setPremiumRange(event.target.value)}><option value="">Not provided</option><option>$1,000–$2,499</option><option>$2,500–$4,999</option><option>$5,000–$9,999</option><option>$10,000+</option></select></label>
            </div>
            <button className="secondary-button" onClick={saveInsurance}>Save optional context</button>
            <small>Completed and appropriately verified mitigation documentation may be useful when discussing applicable benefits with an insurer. No discount is promised.</small>
          </div>
        </section>

        <aside className="activity-panel">
          <div className="activity-header">
            <div><p className="eyebrow">GUARDIAN LIVE ACTIVITY</p><h2>{view === "activity" ? "What Guardian is doing" : "Property Resilience Report"}</h2></div>
            <div className="view-toggle">
              <button className={view === "activity" ? "active" : ""} onClick={() => setView("activity")}><Activity size={16} /> Activity</button>
              <button className={view === "report" ? "active" : ""} onClick={() => setView("report")}><FileText size={16} /> Report</button>
            </div>
          </div>

          {view === "activity" ? <>
            <div className="timeline" aria-live="polite">
              {events.length ? events.map((event) => (
                <div className={`timeline-event ${event.state}`} key={event.id}>
                  <div className="timeline-icon">{event.state === "complete" ? <Check size={15} /> : event.state === "error" ? <CircleAlert size={15} /> : <ChevronRight size={15} />}</div>
                  <div><strong>{event.label}</strong>{event.detail ? <span>{event.detail}</span> : null}</div>
                </div>
              )) : <p className="empty-state">Continue into MyGlendale to begin.</p>}
            </div>
            <div className="mapped-context">
              <div className="section-heading"><span>Mapped Context</span><small>{hazards ? "Live GIS response" : "Waiting for lookup"}</small></div>
              {hazards ? <div className="hazard-list">{(Object.entries(hazards.categories) as [GuidanceCategory, HazardContext["categories"][GuidanceCategory]][]).map(([category, item]) => (
                <article className="hazard-card" key={category}>
                  <div className={`hazard-icon ${category}`}>{category === "wildfire" ? <Flame /> : category === "flood" ? <Waves /> : <Zap />}</div>
                  <div><div className="hazard-title"><strong>{GUIDANCE[category].title}</strong><span className={`evidence-badge ${item.status}`}>Public data</span></div><p>{item.label}</p><small>{item.detail}</small>{item.source?.url ? <a href={item.source.url} target="_blank" rel="noreferrer">{item.source.name} source</a> : null}</div>
                </article>
              ))}</div> : <p className="empty-state">Mapped wildfire, flood, and seismic context will appear when you start Guardian.</p>}
            </div>
          </> : <div className="report-view">
            <section><h3>Property</h3><p><strong>{DEMO_PROFILE.businessName}</strong></p><p>{DEMO_PROFILE.address}</p><p>{DEMO_PROFILE.propertyType}</p></section>
            {[["verified", "Verified / public-data information"], ["owner_reported", "Owner-reported information"], ["unverified", "Unverified items"], ["action_recommended", "Recommended actions"]].map(([status, label]) => (
              <section key={status}><h3>{label}</h3>{groupedFindings[status]?.length ? groupedFindings[status].map((finding) => <div className="report-finding" key={finding.id}><strong>{finding.title}</strong><p>{finding.detail}</p>{finding.source?.url ? <a href={finding.source.url} target="_blank" rel="noreferrer">Source: {finding.source.name}</a> : null}</div>) : <p className="empty-state">No items recorded yet.</p>}</section>
            ))}
            <section><h3>Insurance context</h3><p>{insurer || premiumRange ? `${insurer || "Insurer not named"}${premiumRange ? ` · ${premiumRange}` : ""}` : "Not provided."}</p><small>No insurance benefit or premium change is guaranteed.</small></section>
          </div>}
          <div className="safety-footer"><ShieldCheck size={16} /> Planning context only. Not an emergency service or site-specific safety determination.</div>
        </aside>
      </main>
      <BottomNav />
    </div>
  );
}

export default AgentPage;
