"""District boundary / GeoJSON endpoints."""

import os
import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/geojson")
def get_district_geojson():
    """Serve India district boundaries as GeoJSON.
    Place the file at frontend/public/india_districts.geojson
    Source: GADM India admin-2 or geoBoundaries.
    """
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    geojson_path = os.path.join(project_root, "frontend", "public", "india_districts.geojson")
    if not os.path.exists(geojson_path):
        geojson_path = os.path.join("frontend", "public", "india_districts.geojson")
    if os.path.exists(geojson_path):
        with open(geojson_path, "r", encoding="utf-8") as f:
            return JSONResponse(content=json.load(f))
    return {"type": "FeatureCollection", "features": [], "note": "GeoJSON not loaded yet"}
