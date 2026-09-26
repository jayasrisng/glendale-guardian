from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from glendale_gis.core.snapshot import Snapshot
from glendale_gis.core import hazards

import requests

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the downloaded GIS snapshot
snap = Snapshot.load(
    "/Users/jmateofloressnap-contractor/Library/Caches/glendale-gis-mcp/snapshots/20260926"
)


@app.get("/")
def root():
    return {"message": "SafeGlendale backend running"}


@app.get("/hazards")
def get_hazards(lat: float, lon: float):
    location = hazards.locate(
        snap,
        lat,
        lon,
    )

    result = hazards.hazards_at_location(
        snap,
        location,
    )

    return result

@app.get("/feature-geometry")
def get_feature_geometry(layer_url: str, object_id: int):
    url = f"{layer_url}/query"

    params = {
        "where": f"OBJECTID={object_id}",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
    }

    response = requests.get(url, params=params)

    if response.status_code != 200:
        return {
            "error": "Failed to fetch geometry"
        }

    return response.json()