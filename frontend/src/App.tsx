import { BrowserRouter, Routes, Route } from "react-router-dom";
import AgentPage from "./pages/AgentPage";
import MapPage from "./pages/MapPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AgentPage />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
