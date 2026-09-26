"""Forecast endpoints — district-level and gridded."""

from fastapi import APIRouter, Query

from api.database import fetch_district_forecasts
from shared.schemas import DistrictForecast

router = APIRouter()


@router.get("/district", response_model=list[DistrictForecast])
def get_district_forecast(
    date: str = Query(None, description="Forecast date (YYYY-MM-DD)"),
    lead: int = Query(24, description="Lead time in hours"),
):
    """Get district-level corrected rainfall forecasts."""
    return fetch_district_forecasts(lead)


@router.get("/grid")
def get_grid_forecast(
    date: str = Query(None),
    lead: int = Query(24),
):
    """Get gridded corrected forecast (GeoJSON/array)."""
    # TODO: Wire to real grid data at integration
    return {"message": "Grid endpoint — will return corrected grid at integration"}


@router.get("/heavy-rain-prob")
def get_heavy_rain_prob(
    date: str = Query(None),
    threshold: float = Query(64.5, description="Rainfall threshold in mm"),
):
    """Get per-district heavy rain exceedance probabilities."""
    forecasts = fetch_district_forecasts(24)
    return [
        {
            "district_id": f.district_id,
            "district_name": f.district_name,
            "prob": f.heavy_rain_prob_65mm if threshold <= 64.5 else f.heavy_rain_prob_115mm,
        }
        for f in forecasts
    ]
