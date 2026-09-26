from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from glendale_gis.core.snapshot import Snapshot
from glendale_gis.core import hazards,resources

import requests
import os
import json

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel
from typing import Any

from functools import lru_cache

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)

class AdviceRequest(BaseModel):
    hazard: str
    title: str | None = None
    status: str
    distance: float | None = None
    season: str
    properties: dict[str, Any] = {}

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


@app.get("/resources")
def get_resources(
    lat: float,
    lon: float,
    limit: int = 3,
):
    location = hazards.locate(
        snap,
        lat,
        lon,
    )

    result = resources.nearest_resources(
        snap,
        location,
        limit=limit,
    )

    return result

ADVICE_PROMPT_VERSION = "v1"


@lru_cache(maxsize=128)
def get_cached_advice(
    hazard: str,
    title: str | None,
    status: str,
    distance: float | None,
    season: str,
    properties_json: str,
    prompt_version: str,
):
    distance_text = (
        "The user's location overlaps this mapped hazard."
        if distance == 0
        else (
            f"The mapped hazard is approximately {round(distance)} meters away."
            if distance is not None
            else "Distance is unavailable."
        )
    )

    prompt = f"""
You are the safety guidance component of Glendale Guardian.

Generate concise emergency-preparedness guidance using only the GIS context below.

Do not claim that a disaster is currently occurring.
Do not describe GIS hazard data as a real-time forecast.
Clearly distinguish between being inside a mapped hazard area and having one nearby.

Hazard:
{hazard}

GIS title:
{title}

Status:
{status}

Distance:
{distance_text}

Selected season:
{season}

GIS attributes:
{properties_json}

Return only valid JSON:

{{
  "summary": "2-3 concise sentences",
  "tips": [
    "tip 1",
    "tip 2",
    "tip 3"
  ],
  "note": "short caution about mapped hazard data"
}}
"""

    response = client.responses.create(
        # KEEP THE SAME MODEL NAME THAT IS ALREADY WORKING
        model="YOUR_CURRENT_MODEL",
        input=prompt,
    )

    text = response.output_text

    try:
        return json.loads(text)

    except json.JSONDecodeError:
        return {
            "summary": text,
            "tips": [],
            "note": (
                "Mapped hazard data is not a real-time emergency warning."
            ),
        }

@app.post("/ai/advice")
def generate_advice(request: AdviceRequest):
    properties_json = json.dumps(
        request.properties,
        sort_keys=True,
    )

    return get_cached_advice(
        request.hazard,
        request.title,
        request.status,
        request.distance,
        request.season,
        properties_json,
        ADVICE_PROMPT_VERSION,
    )

@lru_cache(maxsize=256)
def fetch_geometry(layer_url: str, object_id: int):
    url = f"{layer_url}/query"

    params = {
        "where": f"OBJECTID={object_id}",
        "outFields": "*",
        "returnGeometry": "true",
        "f": "geojson",
    }

    response = requests.get(
        url,
        params=params,
        timeout=30,
    )

    response.raise_for_status()

    return response.json()

@app.get("/feature-geometry")
def get_feature_geometry(
    layer_url: str,
    object_id: int,
):
    return fetch_geometry(
        layer_url,
        object_id,
    )