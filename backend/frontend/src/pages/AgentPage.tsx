import { Mic } from "lucide-react";
import BottomNav from "../components/BottomNav";

function AgentPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: "70px",
      }}
    >
      <h1>SafeGlendale</h1>

      <p
        style={{
          color: "#94a3b8",
          marginBottom: "60px",
        }}
      >
        Your AI Safety Agent
      </p>

      <button
        style={{
          width: "150px",
          height: "150px",
          borderRadius: "50%",
          border: "none",
          background: "#ef4444",
          color: "white",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Mic size={60} />
      </button>

      <h2 style={{ marginTop: "30px" }}>Tap to Speak</h2>

      <p
        style={{
          color: "#94a3b8",
          textAlign: "center",
          maxWidth: "320px",
        }}
      >
        Ask about hazards near you, emergency resources, or how to prepare.
      </p>

      <BottomNav />
    </div>
  );
}

export default AgentPage;