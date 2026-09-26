"""Realistic mock data for frontend development.
Will be replaced by real ML pipeline outputs at integration (Hour 10).
All outputs conform to shared/schemas.py.
"""

import random
import math
from datetime import datetime, timedelta

from shared.schemas import RegimeOutput, DistrictForecast, VerificationSummary
from shared.config import REGIME_CLASSES, IMD_THRESHOLDS

# --- Real Indian district data (50 districts across states) ---
SAMPLE_DISTRICTS = [
    {"id": "IN-MH-MU", "name": "Mumbai", "state": "Maharashtra", "lat": 19.08, "lon": 72.88},
    {"id": "IN-MH-PU", "name": "Pune", "state": "Maharashtra", "lat": 18.52, "lon": 73.86},
    {"id": "IN-MH-NA", "name": "Nagpur", "state": "Maharashtra", "lat": 21.15, "lon": 79.09},
    {"id": "IN-MH-NS", "name": "Nashik", "state": "Maharashtra", "lat": 20.00, "lon": 73.78},
    {"id": "IN-DL-ND", "name": "New Delhi", "state": "Delhi", "lat": 28.61, "lon": 77.21},
    {"id": "IN-KA-BG", "name": "Bengaluru", "state": "Karnataka", "lat": 12.97, "lon": 77.59},
    {"id": "IN-KA-MG", "name": "Mangaluru", "state": "Karnataka", "lat": 12.87, "lon": 74.88},
    {"id": "IN-WB-KO", "name": "Kolkata", "state": "West Bengal", "lat": 22.57, "lon": 88.36},
    {"id": "IN-WB-DA", "name": "Darjeeling", "state": "West Bengal", "lat": 27.04, "lon": 88.26},
    {"id": "IN-TN-CH", "name": "Chennai", "state": "Tamil Nadu", "lat": 13.08, "lon": 80.27},
    {"id": "IN-TN-MA", "name": "Madurai", "state": "Tamil Nadu", "lat": 9.92, "lon": 78.12},
    {"id": "IN-RJ-JP", "name": "Jaipur", "state": "Rajasthan", "lat": 26.91, "lon": 75.79},
    {"id": "IN-RJ-JD", "name": "Jodhpur", "state": "Rajasthan", "lat": 26.24, "lon": 73.02},
    {"id": "IN-KL-TV", "name": "Thiruvananthapuram", "state": "Kerala", "lat": 8.52, "lon": 76.94},
    {"id": "IN-KL-KZ", "name": "Kozhikode", "state": "Kerala", "lat": 11.25, "lon": 75.77},
    {"id": "IN-KL-EK", "name": "Ernakulam", "state": "Kerala", "lat": 9.98, "lon": 76.30},
    {"id": "IN-AS-GU", "name": "Guwahati", "state": "Assam", "lat": 26.14, "lon": 91.74},
    {"id": "IN-GJ-AH", "name": "Ahmedabad", "state": "Gujarat", "lat": 23.02, "lon": 72.57},
    {"id": "IN-GJ-SU", "name": "Surat", "state": "Gujarat", "lat": 21.17, "lon": 72.83},
    {"id": "IN-UP-LK", "name": "Lucknow", "state": "Uttar Pradesh", "lat": 26.85, "lon": 80.95},
    {"id": "IN-UP-VR", "name": "Varanasi", "state": "Uttar Pradesh", "lat": 25.32, "lon": 82.99},
    {"id": "IN-MP-BH", "name": "Bhopal", "state": "Madhya Pradesh", "lat": 23.26, "lon": 77.41},
    {"id": "IN-MP-IN", "name": "Indore", "state": "Madhya Pradesh", "lat": 22.72, "lon": 75.86},
    {"id": "IN-HR-CH", "name": "Chandigarh", "state": "Haryana", "lat": 30.73, "lon": 76.78},
    {"id": "IN-JH-RA", "name": "Ranchi", "state": "Jharkhand", "lat": 23.34, "lon": 85.31},
    {"id": "IN-OR-BH", "name": "Bhubaneswar", "state": "Odisha", "lat": 20.30, "lon": 85.82},
    {"id": "IN-OR-PU", "name": "Puri", "state": "Odisha", "lat": 19.81, "lon": 85.83},
    {"id": "IN-GA-PA", "name": "Panaji", "state": "Goa", "lat": 15.50, "lon": 73.83},
    {"id": "IN-UK-DE", "name": "Dehradun", "state": "Uttarakhand", "lat": 30.32, "lon": 78.03},
    {"id": "IN-SK-GA", "name": "Gangtok", "state": "Sikkim", "lat": 27.33, "lon": 88.62},
    {"id": "IN-ML-SH", "name": "Shillong", "state": "Meghalaya", "lat": 25.57, "lon": 91.88},
    {"id": "IN-MN-IM", "name": "Imphal", "state": "Manipur", "lat": 24.82, "lon": 93.95},
    {"id": "IN-TR-AG", "name": "Agartala", "state": "Tripura", "lat": 23.83, "lon": 91.28},
    {"id": "IN-PB-AM", "name": "Amritsar", "state": "Punjab", "lat": 31.63, "lon": 74.87},
    {"id": "IN-BR-PA", "name": "Patna", "state": "Bihar", "lat": 25.61, "lon": 85.14},
    {"id": "IN-CG-RA", "name": "Raipur", "state": "Chhattisgarh", "lat": 21.25, "lon": 81.63},
    {"id": "IN-AP-VK", "name": "Visakhapatnam", "state": "Andhra Pradesh", "lat": 17.69, "lon": 83.22},
    {"id": "IN-TS-HY", "name": "Hyderabad", "state": "Telangana", "lat": 17.39, "lon": 78.49},
    {"id": "IN-HP-SH", "name": "Shimla", "state": "Himachal Pradesh", "lat": 31.10, "lon": 77.17},
    {"id": "IN-JK-SR", "name": "Srinagar", "state": "Jammu & Kashmir", "lat": 34.08, "lon": 74.80},
]

# Seeded RNG for consistent demo experience
_rng = random.Random(42)


def categorize_rainfall(mm: float) -> str:
    """Map rainfall mm to IMD category."""
    if mm < 0.1:
        return "light"
    for cat, (lo, hi) in IMD_THRESHOLDS.items():
        if lo <= mm <= hi:
            return cat
    return "extremely_heavy"


def mock_regime_current() -> RegimeOutput:
    """Generate a realistic current regime."""
    # Weight towards active/normal during monsoon
    regime = _rng.choices(
        REGIME_CLASSES,
        weights=[0.35, 0.15, 0.10, 0.05, 0.35],
    )[0]
    probs = {r: round(_rng.uniform(0.03, 0.12), 3) for r in REGIME_CLASSES}
    probs[regime] = round(_rng.uniform(0.52, 0.82), 3)
    total = sum(probs.values())
    probs = {k: round(v / total, 3) for k, v in probs.items()}
    return RegimeOutput(date=datetime.now(), regime=regime, probabilities=probs)


def mock_regime_history(start: str, end: str) -> list[RegimeOutput]:
    """Generate a timeline of daily regime classifications."""
    s = datetime.strptime(start, "%Y-%m-%d")
    e = datetime.strptime(end, "%Y-%m-%d")
    history = []
    current_regime = "normal"
    spell_length = 0
    rng = random.Random(123)

    day = s
    while day <= e:
        spell_length += 1
        # Regime transitions every 3-10 days
        if spell_length > rng.randint(3, 10):
            current_regime = rng.choices(
                REGIME_CLASSES, weights=[0.30, 0.15, 0.10, 0.05, 0.40]
            )[0]
            spell_length = 0

        probs = {r: round(rng.uniform(0.02, 0.10), 3) for r in REGIME_CLASSES}
        probs[current_regime] = round(rng.uniform(0.55, 0.85), 3)
        total = sum(probs.values())
        probs = {k: round(v / total, 3) for k, v in probs.items()}

        history.append(RegimeOutput(
            date=day, regime=current_regime, probabilities=probs
        ))
        day += timedelta(days=1)

    return history


import rasterio

def get_chirps_value(lat, lon, filepath='chirps_sample.tif'):
    try:
        with rasterio.open(filepath) as src:
            row, col = src.index(lon, lat)
            val = src.read(1)[row, col]
            if val < 0: # CHIRPS nodata is -9999
                return 0.0
            return float(val)
    except Exception as e:
        print(f"Error reading CHIRPS: {e}")
        return 0.0

def mock_district_forecasts(lead_hours: int = 24) -> list[DistrictForecast]:
    """Generate forecasts using REAL CHIRPS data!"""
    regime = mock_regime_current()
    forecasts = []

    for d in SAMPLE_DISTRICTS:
        # Fetch real rainfall from CHIRPS 2.0 dataset
        raw_val = get_chirps_value(d['lat'], d['lon'])
        
        # Apply ML correction (dummy proxy for the missing pkl weights)
        correction_factor = 1.05 if raw_val > 10 else 0.95
        corrected = round(raw_val * correction_factor, 1)

        heavy_65 = None
        heavy_115 = None
        if corrected > 25:
            heavy_65 = round(min(0.95, corrected / 150), 3)
            heavy_115 = round(min(0.80, corrected / 300), 3)

        forecasts.append(DistrictForecast(
            district_id=d['id'],
            district_name=d['name'],
            state=d['state'],
            lat=d['lat'],
            lon=d['lon'],
            date=datetime.now(),
            lead_hours=lead_hours,
            raw_precip_mm=round(raw_val, 1),
            corrected_precip_mm=corrected,
            regime=regime.regime,
            regime_confidence=regime.probabilities[regime.regime],
            heavy_rain_prob_65mm=heavy_65,
            heavy_rain_prob_115mm=heavy_115,
            category=categorize_rainfall(corrected),
        ))

    return forecasts


def mock_verification_summary(regime: str = "active") -> VerificationSummary:
    """Generate realistic verification metrics showing improvement."""
    rng = random.Random(hash(regime))

    # Raw metrics (worse)
    rmse_raw = round(rng.uniform(16, 28), 1)
    mae_raw = round(rng.uniform(10, 19), 1)

    # Corrected metrics (better — 15-35% improvement)
    improvement = rng.uniform(0.15, 0.35)
    rmse_corr = round(rmse_raw * (1 - improvement), 1)
    mae_corr = round(mae_raw * (1 - improvement), 1)

    # ETS at each threshold (corrected always better)
    ets = {}
    for threshold in ["15.5", "64.5", "115.5"]:
        raw_ets = round(rng.uniform(0.08, 0.30), 3)
        corr_ets = round(raw_ets + rng.uniform(0.05, 0.18), 3)
        ets[threshold] = {"raw": raw_ets, "corrected": min(corr_ets, 0.55)}

    return VerificationSummary(
        regime=regime,
        period_start=datetime(2023, 6, 1),
        period_end=datetime(2023, 9, 30),
        rmse_raw=rmse_raw,
        rmse_corrected=rmse_corr,
        mae_raw=mae_raw,
        mae_corrected=mae_corr,
        ets_by_threshold=ets,
    )
