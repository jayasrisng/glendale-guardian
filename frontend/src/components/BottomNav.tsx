import { NavLink } from "react-router-dom";
import { Mic, Map } from "lucide-react";

function BottomNav() {
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "70px",
        background: "white",
        borderTop: "1px solid #ddd",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <NavLink to="/" style={{ textDecoration: "none", color: "black" }}>
        <div style={{ textAlign: "center" }}>
          <Mic />
          <div>Agent</div>
        </div>
      </NavLink>

      <NavLink to="/map" style={{ textDecoration: "none", color: "black" }}>
        <div style={{ textAlign: "center" }}>
          <Map />
          <div>Map</div>
        </div>
      </NavLink>
    </nav>
  );
}

export default BottomNav;