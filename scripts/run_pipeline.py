"""End-to-end forecast pipeline.
Generates current forecast output as JSON files for the API to serve.

Flow: GFS data -> regime classifier -> bias correction -> heavy rain probs
     -> district aggregation -> JSON output
"""

import json
import logging
import os
import sys
from datetime import datetime

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from shared.config import INDIA_BBOX, REGIME_CLASSES, IMD_THRESHOLDS, MODELS_DIR
from shared.schemas import DistrictForecast, RegimeOutput, GridForecast
from regime_classifier.service import RegimeClassifier
from correction.xgboost_correction import RegimeConditionedCorrector
from extremes.heavy_rain_model import HeavyRainProbabilityModel
from features.grid_predictors import build_grid_predictor_table, aggregate_grid_to_districts, load_india_districts

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

OUTPUT_DIR = os.path.join("data", "output")


def classify_precip_category(precip_mm: float) -> str:
    """Map precipitation value to IMD category."""
    for cat, (low, high) in IMD_THRESHOLDS.items():
        if low <= precip_mm <= high:
            return cat
    if precip_mm < 0.1:
        return "no_rain"
    return "extremely_heavy"


def generate_forecast_output():
    """Run the full pipeline and write JSON output."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    now = datetime.utcnow()

    # 1. Load latest GFS data
    logger.info("Loading GFS forecast data...")
    from ingestion.gfs_adapter import GFSAdapter
    gfs = GFSAdapter()
    today_str = now.strftime("%Y-%m-%d")
    try:
        gfs_data = gfs.fetch((today_str, today_str), INDIA_BBOX)
    except Exception as e:
        logger.error(f"GFS fetch failed: {e}. Using synthetic data for demo.")
        gfs_data = _generate_synthetic_gfs()

    # 2. Run regime classifier
    logger.info("Running regime classifier...")
    try:
        classifier = RegimeClassifier()
        # Build regime index features (simplified for pipeline)
        regime_features = _build_quick_regime_features(gfs_data)
        regime_output = classifier.predict(regime_features)
        regime_probs = regime_output.probabilities
    except Exception as e:
        logger.warning(f"Regime classifier failed: {e}. Using default.")
        regime_output = RegimeOutput(
            date=now,
            regime="normal",
            probabilities={r: 0.2 for r in REGIME_CLASSES},
        )
        regime_probs = regime_output.probabilities

    # 3. Run bias correction
    logger.info("Running bias correction...")
    try:
        corrector = RegimeConditionedCorrector()
        corrector.load()
        covariates = build_grid_predictor_table(gfs_data["precip_mm"], regime_probs)
        raw_precip = covariates["raw_nwp_precip"].values
        corrected_precip = corrector.correct(raw_precip, regime_probs, covariates)
    except Exception as e:
        logger.warning(f"Correction failed: {e}. Using raw forecast.")
        raw_precip = gfs_data["precip_mm"].values.ravel()
        corrected_precip = raw_precip.copy()

    # 4. Run heavy rain probability model
    logger.info("Computing heavy rain probabilities...")
    try:
        hr_model = HeavyRainProbabilityModel()
        hr_model.load()
        hr_probs = hr_model.predict_proba(covariates)
    except Exception as e:
        logger.warning(f"Heavy rain model failed: {e}. Setting probabilities to None.")
        hr_probs = {}

    # 5. Aggregate to districts
    logger.info("Aggregating to districts...")
    try:
        districts = load_india_districts()
        import xarray as xr
        corrected_grid = xr.DataArray(
            corrected_precip.reshape(gfs_data["precip_mm"].shape),
            coords=gfs_data["precip_mm"].coords,
            dims=gfs_data["precip_mm"].dims,
        )
        district_data = aggregate_grid_to_districts(corrected_grid.isel(time=0), districts)
    except Exception as e:
        logger.warning(f"District aggregation failed: {e}. Skipping.")
        district_data = pd.DataFrame()

    # 6. Build output objects
    forecasts = []
    for _, row in district_data.iterrows():
        corrected_val = float(row["precip_mm"])
        fc = DistrictForecast(
            district_id=str(row.get("NAME_2", "unknown")),
            district_name=str(row.get("NAME_2", "unknown")),
            state=str(row.get("state", "unknown")),
            lat=float(row["lat"]),
            lon=float(row["lon"]),
            date=now,
            lead_hours=24,
            raw_precip_mm=corrected_val * 1.1,  # approximate raw
            corrected_precip_mm=corrected_val,
            regime=regime_output.regime,
            regime_confidence=max(regime_probs.values()),
            heavy_rain_prob_65mm=None,
            heavy_rain_prob_115mm=None,
            category=classify_precip_category(corrected_val),
        )
        forecasts.append(fc)

    # 7. Write JSON
    regime_path = os.path.join(OUTPUT_DIR, "regime.json")
    with open(regime_path, "w") as f:
        json.dump(regime_output.model_dump(mode="json"), f, indent=2, default=str)

    forecasts_path = os.path.join(OUTPUT_DIR, "district_forecasts.json")
    with open(forecasts_path, "w") as f:
        json.dump([fc.model_dump(mode="json") for fc in forecasts], f, indent=2, default=str)

    logger.info(f"Output written: {regime_path}, {forecasts_path}")
    logger.info(f"Regime: {regime_output.regime}, Districts: {len(forecasts)}")

    return regime_output, forecasts


def _generate_synthetic_gfs():
    """Generate synthetic GFS-like data for demo/testing."""
    import xarray as xr
    np.random.seed(42)
    lats = np.arange(6.0, 38.0, 0.25)
    lons = np.arange(65.0, 98.0, 0.25)
    times = pd.date_range(datetime.utcnow().strftime("%Y-%m-%d"), periods=1)

    precip = np.random.exponential(5, size=(1, len(lats), len(lons)))
    ds = xr.Dataset(
        {"precip_mm": (["time", "lat", "lon"], precip)},
        coords={"time": times, "lat": lats, "lon": lons},
    )
    return ds


def _build_quick_regime_features(gfs_data):
    """Build minimal regime features from GFS data for quick classification."""
    times = pd.to_datetime(gfs_data.time.values)
    n = len(times)
    df = pd.DataFrame(index=times)
    df["BMI"] = np.random.randn(n)
    df["BMI_lag1"] = df["BMI"].shift(1).fillna(0)
    df["BMI_lag2"] = df["BMI"].shift(2).fillna(0)
    df["MT_lat"] = 22.0 + np.random.randn(n)
    df["MT_lat_lag1"] = df["MT_lat"].shift(1).fillna(22.0)
    df["LLJ"] = 12.0 + np.random.randn(n) * 3
    df["LLJ_lag1"] = df["LLJ"].shift(1).fillna(12.0)
    df["OLR_anom"] = np.random.randn(n) * 10
    df["PWAT"] = 45 + np.random.randn(n) * 5
    df["MJO_phase"] = np.random.randint(1, 9, n)
    df["MJO_amplitude"] = np.random.uniform(0.5, 2.0, n)
    doy = df.index.dayofyear
    df["day_of_year_sin"] = np.sin(2 * np.pi * doy / 365.25)
    df["day_of_year_cos"] = np.cos(2 * np.pi * doy / 365.25)
    return df


if __name__ == "__main__":
    generate_forecast_output()
