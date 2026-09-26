"""Shared Pydantic schemas — SINGLE SOURCE OF TRUTH.
Both Person A (data-pipeline) and Person B (api-frontend) import from here.
Do NOT edit without both people's sign-off.
"""

from pydantic import BaseModel
from datetime import datetime


class RegimeOutput(BaseModel):
    """Current regime classification with probability breakdown."""
    date: datetime
    regime: str  # "active" | "break" | "depression" | "western_disturbance" | "normal"
    probabilities: dict[str, float]  # {regime_name: probability}


class DistrictForecast(BaseModel):
    """Forecast data for a single district at a single lead time."""
    district_id: str
    district_name: str
    state: str
    lat: float
    lon: float
    date: datetime
    lead_hours: int
    raw_precip_mm: float
    corrected_precip_mm: float
    regime: str
    regime_confidence: float
    heavy_rain_prob_65mm: float | None = None
    heavy_rain_prob_115mm: float | None = None
    category: str  # "light" | "moderate" | "heavy" | "very_heavy" | "extremely_heavy"


class VerificationSummary(BaseModel):
    """Verification metrics comparing raw NWP vs AI-corrected forecasts."""
    regime: str
    period_start: datetime
    period_end: datetime
    rmse_raw: float
    rmse_corrected: float
    mae_raw: float
    mae_corrected: float
    ets_by_threshold: dict[str, dict[str, float]]  # {threshold: {raw: x, corrected: y}}


class GridForecast(BaseModel):
    """Gridded forecast data for map rendering."""
    date: datetime
    lead_hours: int
    lats: list[float]
    lons: list[float]
    raw_precip: list[list[float]]
    corrected_precip: list[list[float]]
    regime_overlay: str
