import { NavLink } from "react-router-dom";
import { Mic, Map } from "lucide-react";

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>
        <div><Mic size={21} /><span>Guardian</span></div>
      </NavLink>
      <NavLink to="/map" className={({ isActive }) => isActive ? "active" : ""}>
        <div><Map size={21} /><span>Map</span></div>
      </NavLink>
    </nav>
  );
}

export default BottomNav;
