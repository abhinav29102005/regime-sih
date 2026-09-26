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
    geojson_path = os.path.join("frontend", "public", "india_districts.geojson")
    if os.path.exists(geojson_path):
        with open(geojson_path) as f:
            return JSONResponse(content=json.load(f))
    return {"type": "FeatureCollection", "features": [], "note": "GeoJSON not loaded yet"}
