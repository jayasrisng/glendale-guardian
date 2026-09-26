import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import BottomNav from "../components/BottomNav.tsx";

function MapPage() {
  const [location, setLocation] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation([
          position.coords.latitude,
          position.coords.longitude,
        ]);
      },
      (error) => {
        console.error("Location error:", error);
      }
    );
  }, []);

  if (!location) {
    return <div>Getting your location...</div>;
  }

  return (
    <div className="app-screen">
      <div style={{ padding: "16px" }}>
        <h1>My Area</h1>

        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          <button>Spring</button>
          <button>Summer</button>
          <button>Fall</button>
          <button>Winter</button>
        </div>
      </div>

      <MapContainer
        center={location}
        zoom={14}
        style={{
          height: "75vh",
          width: "100%",
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={location}>
          <Popup>You are here</Popup>
        </Marker>
      </MapContainer>

      <BottomNav />
    </div>
  );
}

export default MapPage;