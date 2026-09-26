from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from glendale_gis.core.snapshot import Snapshot
from glendale_gis.core import hazards

import requests
import os
import json

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel
from typing import Any

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

@app.post("/ai/advice")
def generate_advice(request: AdviceRequest):

    distance_text = (
        "The user's location overlaps this mapped hazard."
        if request.distance == 0
        else (
            f"The mapped hazard is approximately "
            f"{round(request.distance)} meters away."
            if request.distance is not None
            else "Distance is unavailable."
        )
    )

    prompt = f"""
You are the safety guidance component of Glendale Guardian.

Generate concise emergency-preparedness guidance using ONLY the
GIS context supplied below.

Do not claim that a disaster is currently occurring.

Do not describe this GIS data as a prediction or real-time forecast.

Clearly distinguish:
- being inside a mapped hazard area
- having a mapped hazard nearby

Use simple language suitable for the general public.

GIS CONTEXT

Hazard type:
{request.hazard}

GIS title:
{request.title}

GIS status:
{request.status}

Distance context:
{distance_text}

Selected season:
{request.season}

GIS feature attributes:
{json.dumps(request.properties)}

Return ONLY valid JSON in this exact format:

{{
  "summary": "2-3 short sentences explaining what the GIS result means.",
  "tips": [
    "actionable preparation tip",
    "actionable preparation tip",
    "actionable preparation tip"
  ],
  "note": "one short caution about the limits of mapped hazard data"
}}
"""

    response = client.responses.create(
        model="gpt-5.6-luna",
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
                "This information is based on mapped hazard data "
                "and is not a real-time emergency warning."
            ),
        }