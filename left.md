# 🅰️ Person A — Remaining Work

> **Branch:** `feature/data-pipeline`
> **What's done:** Project structure, shared schemas, ingestion adapters (GFS/CHIRPS/ERA5), feature engineering (regime indices + grid predictors), regime classifier (train + service), quantile mapping baseline.
> **What's left:** Listed below in priority order.

---

## ✅ DONE (already committed)

| File | Status |
|---|---|
| `shared/schemas.py` | ✅ Complete — Pydantic models |
| `shared/config.py` | ✅ Complete — constants, thresholds, paths |
| `ingestion/base.py` | ✅ Complete — abstract DataSourceAdapter |
| `ingestion/gfs_adapter.py` | ✅ Complete — S3 download, GRIB2 parse, bbox subset |
| `ingestion/chirps_adapter.py` | ✅ Complete — HTTP download, regrid 0.05→0.25° |
| `ingestion/era5_adapter.py` | ✅ Complete — CDS API for MSLP, 850hPa wind, TCWV |
| `features/regime_indices.py` | ✅ Complete — BMI, MT_lat, LLJ, OLR, MJO, build_regime_index_table |
| `features/grid_predictors.py` | ✅ Complete — grid predictor table, district aggregation |
| `regime_classifier/train.py` | ✅ Complete — bootstrap labels, XGBoost training, class weighting |
| `regime_classifier/service.py` | ✅ Complete — inference wrapper returning RegimeOutput |
| `correction/quantile_mapping.py` | ✅ Complete — empirical CDF transfer with zero-rain handling |

---

## 🔲 TODO — Priority 1 (Must Have)

### 1. `correction/xgboost_correction.py` — Regime-Conditioned XGBoost Correction

The core novel contribution. One XGBoost regressor per regime, probability-weighted blending.

```python
# Key implementation points:
# - Target: residual = P_obs - P_raw (predict the bias, not absolute rainfall)
# - Feature vector: raw_precip, regime_probs, elevation, dist_to_coast, lead_time, spatial context
# - Weighted MSE: upweight heavy-rain cases by α=3
# - Train one model per regime
# - Blending: P_corrected = Σ_k P(regime=k) × (P_raw + residual_hat_k)
# - Save models to data/models/correction_{regime}.pkl
```

### 2. `scripts/download_historical.py` — Data Download Script

```python
# Download 1 monsoon season (June-Sept 2023) for:
# - CHIRPS observed rainfall (fastest, no auth)
# - GFS forecast data from S3
# - ERA5 regime index variables (may queue 15-30 min)
# Cache to data/raw/
```

### 3. `scripts/run_pipeline.py` — End-to-End Pipeline Runner

```python
# This is what Person B's API will call at integration (Hour 10):
# 1. Load latest GFS data
# 2. Compute regime indices → feed to classifier
# 3. Run regime classifier → RegimeOutput
# 4. Run bias correction → corrected forecast
# 5. Aggregate to districts → list[DistrictForecast]
# 6. Write JSON output for API to serve
```

---

## 🔲 TODO — Priority 2 (Should Have)

### 4. `extremes/heavy_rain_model.py` — Heavy Rain Probability

```python
# Binary XGBoost classifiers for thresholds 64.5mm, 115.5mm
# Features: corrected_precip, regime_probs, ensemble_spread, terrain, climatological P95/P99
# Loss: binary cross-entropy with inverse-frequency class weighting
# Post-hoc calibration: isotonic regression
# Output: {threshold_mm: calibrated_probability}
```

### 5. `verification/metrics.py` — Verification Module

```python
# Continuous: RMSE, MAE, Bias, correlation (r)
# Categorical: POD, FAR, CSI, ETS at each IMD threshold
# Spatial: FSS at neighborhood sizes [1, 3, 5, 9, 15]
# Run raw-vs-corrected comparison → VerificationSummary schema
# See pa.md for full code templates
```

---

## 🔲 TODO — Priority 3 (Stretch)

### 6. OLR Data Integration
- Download NOAA OLR from `https://psl.noaa.gov/data/gridded/data.olrcdr.interp.html`
- Compute OLR anomaly and feed into regime_indices.py (currently placeholder `OLR_anom = 0.0`)

### 7. LPS/WD Flag Parsing
- Parse IMD RSMC best-track bulletins for Low Pressure System flags
- Parse 500hPa trough detection for Western Disturbance flags
- Currently `LPS_flag = 0` and `WD_flag = 0` (placeholder)

### 8. ConvLSTM/U-Net Spatial Correction (Phase 8 stretch goal)
- Input tensor: (C, H, W) where C = [raw_precip, elevation, regime_prob_maps]
- Pixelwise weighted MSE + optional FSS-based loss

---

## 🔑 Integration Notes for Person B

At Hour 10, Person A merges `feature/data-pipeline` to `main` first. Then Person B rebases.

**What Person B needs from you:**
1. `regime_classifier/service.py` → `RegimeClassifier.predict()` returns `RegimeOutput`
2. `correction/xgboost_correction.py` → `RegimeConditionedCorrector.correct()` returns corrected precip array
3. `extremes/heavy_rain_model.py` → `HeavyRainProbabilityModel.predict_proba()` returns `{threshold: prob}`
4. `verification/metrics.py` → `run_verification()` returns a dict matching `VerificationSummary`

All outputs must match the Pydantic schemas in `shared/schemas.py`.
