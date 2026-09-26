# 🅰️ Person A — Data & ML Pipeline

> **Branch:** `feature/data-pipeline`
> **Your domain:** Everything from raw data download → trained models → JSON output matching shared schemas
> **Person B is building:** FastAPI + React frontend on `feature/api-frontend` — they'll stub your endpoints with mock data and swap in your real outputs at Hour 10

---

## Shared Contract (Agree with Person B at Hour 0)

> [!IMPORTANT]
> You and Person B **must** spend the first 30 minutes together creating `shared/schemas.py` and the directory structure. This is the interface contract — if these drift, integration at Hour 10 will fail.

### Pydantic Schemas (`shared/schemas.py`)

Both of you import from this file. **Neither person edits it without the other's sign-off.**

```python
# shared/schemas.py
from pydantic import BaseModel
from datetime import datetime

class RegimeOutput(BaseModel):
    date: datetime
    regime: str  # "active" | "break" | "depression" | "western_disturbance" | "normal"
    probabilities: dict[str, float]  # {regime_name: probability}

class DistrictForecast(BaseModel):
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
    heavy_rain_prob_65mm: float | None
    heavy_rain_prob_115mm: float | None
    category: str  # "light" | "moderate" | "heavy" | "very_heavy" | "extremely_heavy"

class VerificationSummary(BaseModel):
    regime: str
    period_start: datetime
    period_end: datetime
    rmse_raw: float
    rmse_corrected: float
    mae_raw: float
    mae_corrected: float
    ets_by_threshold: dict[str, dict[str, float]]  # {threshold: {raw: x, corrected: y}}

class GridForecast(BaseModel):
    date: datetime
    lead_hours: int
    lats: list[float]
    lons: list[float]
    raw_precip: list[list[float]]
    corrected_precip: list[list[float]]
    regime_overlay: str
```

### Your Directory Ownership

```
regime-sih/
├── shared/                 ← 🤝 SHARED (co-owned, don't edit alone)
│   ├── schemas.py
│   └── config.py
├── ingestion/              ← ✅ YOURS
│   ├── base.py
│   ├── gfs_adapter.py
│   ├── chirps_adapter.py
│   └── era5_adapter.py
├── features/               ← ✅ YOURS
│   ├── regime_indices.py
│   └── grid_predictors.py
├── regime_classifier/      ← ✅ YOURS
│   ├── train.py
│   └── service.py
├── correction/             ← ✅ YOURS
│   ├── quantile_mapping.py
│   └── xgboost_correction.py
├── extremes/               ← ✅ YOURS
│   └── heavy_rain_model.py
├── verification/           ← ✅ YOURS (compute logic; B exposes via API)
│   └── metrics.py
├── scripts/                ← ✅ YOURS
│   └── download_historical.py
├── data/                   ← ✅ YOURS (gitignored)
│   ├── raw/
│   ├── processed/
│   └── models/
├── api/                    ← ❌ Person B's territory
├── frontend/               ← ❌ Person B's territory
└── requirements.txt        ← 🤝 SHARED
```

### Config Constants (`shared/config.py`)

```python
# shared/config.py
INDIA_BBOX = (6.0, 38.0, 65.0, 98.0)  # (lat_min, lat_max, lon_min, lon_max)
MONSOON_CORE_ZONE = (18.0, 28.0, 73.0, 86.0)

IMD_THRESHOLDS = {
    "light": (0.1, 15.5),
    "moderate": (15.6, 64.4),
    "heavy": (64.5, 115.5),
    "very_heavy": (115.6, 204.4),
    "extremely_heavy": (204.5, float("inf")),
}

REGIME_CLASSES = ["active", "break", "depression", "western_disturbance", "normal"]

DATA_DIR = "data/"
RAW_DIR = "data/raw/"
PROCESSED_DIR = "data/processed/"
MODELS_DIR = "data/models/"
```

---

## Git Setup

```bash
git clone <repo-url>
cd regime-sih
git checkout -b feature/data-pipeline
```

**Merge rules:**
- Work exclusively on `feature/data-pipeline`
- Only edit files in `ingestion/`, `features/`, `regime_classifier/`, `correction/`, `extremes/`, `verification/`, `scripts/`, `data/`
- `shared/` changes → tell Person B, get agreement, then push
- Merge to `main` at Hour 10 (you merge first, then Person B rebases)

---

## Environment Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**`requirements.txt` (your additions):**
```
# Data
xarray
cfgrib
netCDF4
boto3
requests
geopandas
shapely
regionmask
rioxarray

# ML
xgboost
scikit-learn
pandas
numpy

# Shared
pydantic>=2.0
```

---

## Hour-by-Hour Execution Plan

---

### ⏱️ Hour 0–0.5 — Shared Setup (WITH Person B)

- [ ] Create directory structure (full tree above)
- [ ] Write `shared/schemas.py` together
- [ ] Write `shared/config.py` together
- [ ] Write `requirements.txt` together
- [ ] Commit: `"chore: initial project structure + shared schemas"`
- [ ] Push, both pull from main, then branch off

**🔑 Exit criteria:** Person B can import from `shared/schemas.py` on their machine.

---

### ⏱️ Hours 0.5–3 — Data Ingestion

**Goal:** Real GFS + CHIRPS data downloaded, normalized, cached locally.

#### `ingestion/base.py`

```python
from abc import ABC, abstractmethod
import xarray as xr

class DataSourceAdapter(ABC):
    @abstractmethod
    def fetch(self, date_range: tuple, bbox: tuple) -> xr.Dataset:
        """Returns standardized xarray Dataset with dims (time, lat, lon)
        and variable 'precip_mm'. Forecast data also has 'forecast_lead_hours'."""
        ...

    @abstractmethod
    def source_metadata(self) -> dict:
        """Returns {name, resolution, latency, license, last_updated}."""
        ...
```

#### `ingestion/gfs_adapter.py` — Priority 1

- Download GFS 0.25° from `s3://noaa-gfs-bdp-pds/` (no auth, use `boto3`)
- Path pattern: `gfs.YYYYMMDD/HH/atmos/gfs.tHHz.pgrb2.0p25.fFFF`
- Extract: `APCP` (accumulated precip) variable using `cfgrib`
- Subset to India bbox, normalize to `(time, lat, lon, precip_mm)`
- Cache to `data/raw/gfs/YYYYMMDD_HH.nc`

```python
import boto3
from botocore import UNSIGNED
from botocore.config import Config
import xarray as xr
import cfgrib

class GFSAdapter(DataSourceAdapter):
    def __init__(self):
        self.s3 = boto3.client('s3', config=Config(signature_version=UNSIGNED))
        self.bucket = 'noaa-gfs-bdp-pds'

    def fetch(self, date_range, bbox):
        # 1. List keys for date range
        # 2. Download GRIB2 files
        # 3. Open with cfgrib, filter for APCP
        # 4. Subset to bbox
        # 5. Normalize dims/vars
        ...
```

#### `ingestion/chirps_adapter.py` — Priority 2

- Direct HTTP download from `https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/netcdf/p05/`
- File pattern: `chirps-v2.0.YYYY.days_p05.nc` (one file per year)
- Subset to India bbox
- Regrid to 0.25° to match GFS (use `xarray.interp` or simple block averaging)

```python
import requests
import xarray as xr

class CHIRPSAdapter(DataSourceAdapter):
    BASE_URL = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/netcdf/p05/"

    def fetch(self, date_range, bbox):
        # 1. Download yearly NetCDF files
        # 2. Open with xarray
        # 3. Subset to bbox and date range
        # 4. Regrid to 0.25° (coarsen or interp)
        # 5. Rename to 'precip_mm'
        ...
```

#### `ingestion/era5_adapter.py` — Priority 3

- Use `cdsapi` (requires free Copernicus CDS account)
- Fetch: `mean_sea_level_pressure`, `u_component_of_wind` + `v_component_of_wind` at 850hPa, `total_column_water_vapour`
- These feed regime index computation, NOT directly into the correction model

> [!TIP]
> **Time-saver:** Start the ERA5 download request immediately after writing the adapter — CDS queue can take 15-30 min. Work on feature engineering while it downloads.

#### `scripts/download_historical.py`

```python
"""Download 2-3 monsoon seasons (June-Sept) of GFS + CHIRPS + ERA5.
Run this ASAP — data downloads are the bottleneck."""

from ingestion.gfs_adapter import GFSAdapter
from ingestion.chirps_adapter import CHIRPSAdapter
from ingestion.era5_adapter import ERA5Adapter
from shared.config import INDIA_BBOX

def main():
    bbox = INDIA_BBOX
    # Start with just 1 season for speed: June-Sept 2023
    date_range = ("2023-06-01", "2023-09-30")

    print("Downloading CHIRPS (fastest, no auth)...")
    CHIRPSAdapter().fetch(date_range, bbox)

    print("Downloading GFS from S3 (no auth, fast)...")
    GFSAdapter().fetch(date_range, bbox)

    print("Submitting ERA5 request (may queue)...")
    ERA5Adapter().fetch(date_range, bbox)

if __name__ == "__main__":
    main()
```

**Commit at Hour 3:** `"feat: data ingestion adapters for GFS, CHIRPS, ERA5"`

---

### ⏱️ Hours 3–5 — Feature Engineering

**Goal:** Regime index table + grid predictor table from downloaded data.

#### `features/regime_indices.py`

Implement each regime index from README Section 4.1:

```python
import xarray as xr
import numpy as np
import pandas as pd

def compute_monsoon_trough_lat(mslp: xr.DataArray) -> pd.Series:
    """MT_lat(t) = argmin_lat[MSLP(lat, lon=75-85E, t)] in 15-30N band."""
    mslp_strip = mslp.sel(lat=slice(15, 30), lon=slice(75, 85))
    return mslp_strip.mean(dim='lon').idxmin(dim='lat')

def compute_bmi(precip: xr.DataArray, clim_mean: xr.DataArray, clim_std: xr.DataArray) -> pd.Series:
    """BMI(t) = [P_MCZ(t) - P̄_clim] / σ_clim
    MCZ = Monsoon Core Zone [18-28N, 73-86E]"""
    mcz = precip.sel(lat=slice(18, 28), lon=slice(73, 86)).mean(dim=['lat', 'lon'])
    return (mcz - clim_mean) / clim_std

def compute_llj_index(wind_850: xr.DataArray) -> pd.Series:
    """LLJ(t) = mean wind speed at 850hPa over [5-15N, 70-80E]."""
    box = wind_850.sel(lat=slice(5, 15), lon=slice(70, 80))
    return box.mean(dim=['lat', 'lon'])

def compute_olr_anomaly(olr: xr.DataArray, clim: xr.DataArray) -> pd.Series:
    """OLR anomaly over India domain."""
    return (olr - clim).mean(dim=['lat', 'lon'])

def fetch_mjo_index() -> pd.DataFrame:
    """Parse BOM RMM index from plain text URL."""
    url = "http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt"
    # Parse fixed-width text file
    # Return DataFrame with columns: [date, RMM1, RMM2, phase, amplitude]
    ...

def build_regime_index_table(era5_data, chirps_data) -> pd.DataFrame:
    """Assemble all indices into one table: one row per day."""
    # Compute each index
    # Add day_of_year_sin, day_of_year_cos
    # Return DataFrame with all columns needed for classifier
    ...
```

#### `features/grid_predictors.py`

```python
def build_grid_predictor_table(gfs_data, regime_probs, terrain_data):
    """One row per (time, lat, lon) with all features for correction model.

    Columns: raw_nwp_precip, elevation, dist_to_coast, terrain_slope,
             regime_prob_active, ..., regime_prob_normal,
             lead_time_hours, surrounding_8_precip (spatial context),
             lag1_observed_precip
    """
    ...
```

#### `features/district_aggregation.py`

```python
import geopandas as gpd
import regionmask

def load_india_districts() -> gpd.GeoDataFrame:
    """Load GADM India admin-2 boundaries."""
    # Download from https://gadm.org/download_country.html or use bundled shapefile
    ...

def aggregate_grid_to_districts(grid_data: xr.DataArray, districts: gpd.GeoDataFrame) -> pd.DataFrame:
    """Spatial average of gridded data per district polygon."""
    ...
```

**Commit at Hour 5:** `"feat: feature engineering — regime indices + grid predictors + district aggregation"`

---

### 🔄 Sync Point — Hour 3 (10 min)

> Quick check with Person B:
> - "I have data flowing from GFS/CHIRPS — here's the shape of the output"
> - "Any changes to the shared schemas?"
> - "Is the API returning mock data yet?"

---

### ⏱️ Hours 5–7 — Regime Classifier

**Goal:** Working XGBoost 5-class classifier that outputs `RegimeOutput` schema.

#### `regime_classifier/train.py`

```python
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
import numpy as np
import pandas as pd

def bootstrap_regime_labels(index_table: pd.DataFrame) -> pd.Series:
    """Rule-based labeling from README Section 4.2:
    BMI ≤ -1.0 for ≥2 consecutive days → break
    BMI ≥ +1.0 for ≥2 consecutive days → active
    LPS_flag = 1 → depression
    WD_flag = 1 → western_disturbance
    else → normal
    """
    labels = pd.Series("normal", index=index_table.index)

    # Rolling 2-day BMI check
    bmi = index_table["BMI"]
    break_mask = (bmi <= -1.0) & (bmi.shift(1) <= -1.0)
    active_mask = (bmi >= 1.0) & (bmi.shift(1) >= 1.0)

    labels[break_mask] = "break"
    labels[active_mask] = "active"
    labels[index_table["LPS_flag"] == 1] = "depression"
    labels[index_table["WD_flag"] == 1] = "western_disturbance"

    return labels

def train_regime_classifier(index_table: pd.DataFrame):
    """Train XGBoost multi-class classifier."""
    feature_cols = [
        "BMI", "BMI_lag1", "BMI_lag2",
        "MT_lat", "MT_lat_lag1",
        "LLJ", "LLJ_lag1",
        "OLR_anom", "PWAT",
        "MJO_phase", "MJO_amplitude",
        "day_of_year_sin", "day_of_year_cos"
    ]

    labels = bootstrap_regime_labels(index_table)
    label_map = {name: i for i, name in enumerate(REGIME_CLASSES)}
    y = labels.map(label_map)
    X = index_table[feature_cols]

    # Class weights (inverse frequency)
    class_counts = y.value_counts()
    weights = len(y) / (len(class_counts) * class_counts)
    sample_weights = y.map(weights)

    X_train, X_val, y_train, y_val, w_train, w_val = train_test_split(
        X, y, sample_weights, test_size=0.2, random_state=42
    )

    model = xgb.XGBClassifier(
        objective="multi:softprob",
        num_class=5,
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        eval_metric="mlogloss"
    )
    model.fit(X_train, y_train, sample_weight=w_train,
              eval_set=[(X_val, y_val)], verbose=True)

    print(classification_report(y_val, model.predict(X_val),
          target_names=REGIME_CLASSES))

    joblib.dump(model, "data/models/regime_classifier.pkl")
    return model
```

#### `regime_classifier/service.py`

```python
import joblib
import pandas as pd
from shared.schemas import RegimeOutput
from shared.config import REGIME_CLASSES

class RegimeClassifier:
    def __init__(self, model_path="data/models/regime_classifier.pkl"):
        self.model = joblib.load(model_path)

    def predict(self, index_window: pd.DataFrame) -> RegimeOutput:
        """Takes regime index features for a day, returns RegimeOutput."""
        probs = self.model.predict_proba(index_window.iloc[[-1]])[0]
        regime_idx = probs.argmax()
        return RegimeOutput(
            date=index_window.index[-1],
            regime=REGIME_CLASSES[regime_idx],
            probabilities=dict(zip(REGIME_CLASSES, probs.tolist()))
        )
```

**Commit at Hour 7:** `"feat: XGBoost regime classifier with bootstrap labeling"`

---

### 🔄 Sync Point — Hour 6 (15 min)

> Check with Person B:
> - Show regime classifier output → does it match `RegimeOutput` schema?
> - "My correction engine will output `DistrictForecast` objects — here's a sample"
> - Resolve any schema mismatches NOW, not at Hour 10

---

### ⏱️ Hours 7–9 — Bias Correction Engine

**Goal:** Per-regime correction models that output corrected forecasts.

#### `correction/quantile_mapping.py`

```python
import numpy as np
from scipy.interpolate import interp1d

class QuantileMapper:
    """Per-regime, per-location empirical quantile mapping (baseline)."""

    def fit(self, raw_forecast: np.ndarray, observed: np.ndarray):
        """Fit empirical CDFs from paired raw/obs data."""
        self.quantiles = np.linspace(0, 1, 101)
        self.raw_quantile_vals = np.quantile(raw_forecast[raw_forecast > 0], self.quantiles)
        self.obs_quantile_vals = np.quantile(observed[observed > 0], self.quantiles)

        # Zero-rain probability
        self.p_rain_raw = (raw_forecast > 0).mean()
        self.p_rain_obs = (observed > 0).mean()

        # Interpolation function: F_obs_inv(F_raw(x))
        self.transfer_func = interp1d(
            self.raw_quantile_vals, self.obs_quantile_vals,
            bounds_error=False, fill_value="extrapolate"
        )

    def correct(self, raw: np.ndarray) -> np.ndarray:
        corrected = np.where(raw > 0, self.transfer_func(raw), 0.0)
        return np.clip(corrected, 0, None)
```

#### `correction/xgboost_correction.py`

```python
import xgboost as xgb
import numpy as np
import joblib
from shared.config import REGIME_CLASSES

class RegimeConditionedCorrector:
    """One XGBoost regressor per regime, probability-weighted blending."""

    def __init__(self):
        self.models = {}  # {regime_name: fitted XGBRegressor}

    def train(self, X_by_regime: dict, y_by_regime: dict):
        """Train one model per regime.
        X: feature matrix, y: residual (P_obs - P_raw)."""
        for regime in REGIME_CLASSES:
            if regime not in X_by_regime:
                continue
            X, y = X_by_regime[regime], y_by_regime[regime]

            # Heavy-rain upweighting
            weights = np.ones(len(y))
            heavy_mask = (X["raw_nwp_precip"] + y) > 64.5  # obs > heavy threshold
            weights[heavy_mask] = 3.0

            model = xgb.XGBRegressor(
                n_estimators=200, max_depth=6, learning_rate=0.1,
                objective="reg:squarederror"
            )
            model.fit(X, y, sample_weight=weights)
            self.models[regime] = model

        joblib.dump(self.models, "data/models/correction_models.pkl")

    def correct(self, raw_forecast: np.ndarray, regime_probs: dict,
                covariates) -> np.ndarray:
        """Probability-weighted blend:
        P_corrected = Σ_k P(regime=k) * (P_raw + residual_hat_k)
        """
        corrected = np.zeros_like(raw_forecast, dtype=float)
        for regime, prob in regime_probs.items():
            if regime in self.models and prob > 0.01:
                residual = self.models[regime].predict(covariates)
                corrected += prob * (raw_forecast + residual)
        return np.clip(corrected, 0, None)
```

**Commit at Hour 9:** `"feat: regime-conditioned bias correction (QM + XGBoost + blending)"`

---

### 🔄 Sync Point — Hour 9 (15 min)

> Pre-integration check:
> - "I have end-to-end: GFS → regime → correction → corrected output"
> - "Here's a sample JSON matching DistrictForecast schema — verify your frontend can render it"
> - Plan the integration: what exact files need to change in Person B's API?

---

### ⏱️ Hours 9–11 — Heavy-Rain Probability + Verification

#### `extremes/heavy_rain_model.py`

```python
import xgboost as xgb
from sklearn.isotonic import IsotonicRegression
import numpy as np
import joblib

class HeavyRainProbabilityModel:
    """Binary classifiers for IMD heavy rain thresholds."""

    def __init__(self):
        self.models = {}       # {threshold_mm: XGBClassifier}
        self.calibrators = {}  # {threshold_mm: IsotonicRegression}

    def train(self, X, observed_precip, thresholds=(64.5, 115.5)):
        for tau in thresholds:
            y = (observed_precip >= tau).astype(int)
            w_pos = (y == 0).sum() / max((y == 1).sum(), 1)

            model = xgb.XGBClassifier(
                n_estimators=150, max_depth=5,
                scale_pos_weight=w_pos,
                objective="binary:logistic"
            )
            model.fit(X, y)

            # Isotonic calibration on holdout
            raw_probs = model.predict_proba(X)[:, 1]
            calibrator = IsotonicRegression(out_of_bounds='clip')
            calibrator.fit(raw_probs, y)

            self.models[tau] = model
            self.calibrators[tau] = calibrator

        joblib.dump((self.models, self.calibrators), "data/models/heavy_rain.pkl")

    def predict_proba(self, X) -> dict:
        result = {}
        for tau, model in self.models.items():
            raw_prob = model.predict_proba(X)[:, 1]
            result[tau] = self.calibrators[tau].predict(raw_prob)
        return result
```

#### `verification/metrics.py`

```python
import numpy as np

def rmse(forecast, observed):
    return np.sqrt(np.mean((forecast - observed) ** 2))

def mae(forecast, observed):
    return np.mean(np.abs(forecast - observed))

def bias(forecast, observed):
    return np.mean(forecast - observed)

def correlation(forecast, observed):
    return np.corrcoef(forecast, observed)[0, 1]

def contingency_table(forecast, observed, threshold):
    H = ((forecast >= threshold) & (observed >= threshold)).sum()
    F = ((forecast >= threshold) & (observed < threshold)).sum()
    M = ((forecast < threshold) & (observed >= threshold)).sum()
    CN = ((forecast < threshold) & (observed < threshold)).sum()
    return H, F, M, CN

def pod(H, M): return H / max(H + M, 1)
def far(H, F): return F / max(H + F, 1)
def csi(H, M, F): return H / max(H + M + F, 1)

def ets(H, M, F, CN):
    N = H + M + F + CN
    H_random = (H + M) * (H + F) / max(N, 1)
    return (H - H_random) / max(H + M + F - H_random, 1e-10)

def compute_fss(forecast_grid, observed_grid, threshold, neighborhood):
    """Fractions Skill Score at given neighborhood scale."""
    from scipy.ndimage import uniform_filter
    fcst_binary = (forecast_grid >= threshold).astype(float)
    obs_binary = (observed_grid >= threshold).astype(float)
    frac_fcst = uniform_filter(fcst_binary, size=neighborhood)
    frac_obs = uniform_filter(obs_binary, size=neighborhood)
    fbs = np.mean((frac_fcst - frac_obs) ** 2)
    fbs_worst = np.mean(frac_fcst ** 2) + np.mean(frac_obs ** 2)
    return 1 - fbs / max(fbs_worst, 1e-10)

def run_verification(raw, corrected, observed, thresholds=(15.5, 64.5, 115.5)):
    """Full verification report: raw vs. corrected."""
    report = {
        "continuous": {
            "raw": {"rmse": rmse(raw, observed), "mae": mae(raw, observed),
                    "bias": bias(raw, observed), "r": correlation(raw, observed)},
            "corrected": {"rmse": rmse(corrected, observed), "mae": mae(corrected, observed),
                          "bias": bias(corrected, observed), "r": correlation(corrected, observed)},
        },
        "categorical": {}
    }
    for tau in thresholds:
        H_r, F_r, M_r, CN_r = contingency_table(raw, observed, tau)
        H_c, F_c, M_c, CN_c = contingency_table(corrected, observed, tau)
        report["categorical"][str(tau)] = {
            "raw": {"pod": pod(H_r, M_r), "far": far(H_r, F_r),
                    "csi": csi(H_r, M_r, F_r), "ets": ets(H_r, M_r, F_r, CN_r)},
            "corrected": {"pod": pod(H_c, M_c), "far": far(H_c, F_c),
                          "csi": csi(H_c, M_c, F_c), "ets": ets(H_c, M_c, F_c, CN_c)},
        }
    return report
```

**Commit at Hour 11:** `"feat: heavy-rain probability model + full verification metrics"`

---

### ⏱️ Hours 11–12 — Integration with Person B 🤝

> [!CAUTION]
> This is the most critical window. You and Person B work together.

**What you do:**

1. **Merge your branch to `main` first:**
   ```bash
   git checkout main
   git merge feature/data-pipeline
   git push
   ```

2. **Write a pipeline runner** that Person B's API can call:
   ```python
   # scripts/run_pipeline.py
   """Generate current forecast output as JSON files for the API."""
   from regime_classifier.service import RegimeClassifier
   from correction.xgboost_correction import RegimeConditionedCorrector
   from extremes.heavy_rain_model import HeavyRainProbabilityModel
   import json

   def generate_forecast_output():
       # 1. Load latest GFS data
       # 2. Run regime classifier → RegimeOutput
       # 3. Run bias correction → corrected forecast
       # 4. Run heavy-rain model → probabilities
       # 5. Aggregate to districts → list[DistrictForecast]
       # 6. Write JSON to data/output/ for API to serve
       ...
   ```

3. **Help Person B replace mock data** in their API routes with calls to your pipeline
4. **Test end-to-end:** data → model → API → check JSON shapes
5. **Fix any schema mismatches** (this is why you agreed on schemas at Hour 0)

---

## Fallback: If Data Downloads Are Slow

> [!WARNING]
> CDS/ERA5 queue and large GFS archives can be slow. If you're behind:

1. **Use synthetic/sample data** that matches the real data schema
2. Generate realistic fake regime indices using random walks with monsoon-realistic parameters
3. Train the classifier on synthetic data — the model structure and pipeline are what matter for the demo
4. Document that real data integration is a config swap, not a code change (adapter pattern)

---

## Key Formulas Quick Reference

| What | Formula |
|---|---|
| **BMI** | `(P_MCZ - P̄_clim) / σ_clim` |
| **MT Position** | `argmin_lat[MSLP(15-30N, 75-85E)]` |
| **LLJ Index** | `mean(wind_850hPa over 5-15N, 70-80E)` |
| **Correction Blend** | `P_corrected = Σ_k P(regime=k) × correction_k(raw)` |
| **ETS** | `(H - H_random) / (H + M + F - H_random)` |
| **FSS** | `1 - FBS / FBS_worst` |
