# Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts
## Technical Blueprint v1.0

---

## 0. Document Purpose

This is a build-from blueprint: real public data sources with actual access endpoints, a modular backend architecture, a scalable frontend, and every formula (statistical, ML, verification) needed to implement the system without further literature lookup. It is written to be handed to an engineering team as a starting spec.

---

## 1. System Architecture

### 1.1 High-Level Design Principle

Everything is a **pipeline of independently deployable modules** communicating through a defined schema (not tightly coupled function calls). This lets you swap the regime classifier, the correction model, or the data source without touching the rest of the system, and lets each module scale independently (the ConvLSTM correction module needs a GPU; the API layer doesn't).

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION LAYER                      │
│   NWP fetcher │ Obs/Reanalysis fetcher │ Index fetcher │ Cache    │
└─────────────────────────────┬─────────────────────────────────────┘
                               │  (Parquet/NetCDF on object storage)
┌─────────────────────────────▼─────────────────────────────────────┐
│                     FEATURE ENGINEERING LAYER                     │
│   Regime indices │ Grid predictors │ District aggregation         │
└─────────────────────────────┬─────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌───────────────┐    ┌──────────────────┐   ┌──────────────────────┐
│ Regime         │    │ Bias Correction  │   │ Heavy-Rain            │
│ Classifier     │───▶│ Engine           │──▶│ Probability Model     │
│ Service        │    │ (regime-cond.)   │   │                       │
└───────────────┘    └──────────────────┘   └──────────────────────┘
                               │
┌─────────────────────────────▼─────────────────────────────────────┐
│                   VERIFICATION & SCORING MODULE                   │
│   RMSE/ETS/CSI/POD/FAR/FSS, stratified by regime + threshold      │
└─────────────────────────────┬─────────────────────────────────────┘
                               │
┌─────────────────────────────▼─────────────────────────────────────┐
│                          API LAYER (FastAPI)                      │
│   /forecast  /regime  /verify  /districts  /map-tiles             │
└─────────────────────────────┬─────────────────────────────────────┘
                               │  REST + WebSocket (live updates)
┌─────────────────────────────▼─────────────────────────────────────┐
│                        FRONTEND (React + Map)                     │
│   Dashboard │ District table │ Choropleth map │ Verification view │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Why This Split

- **Ingestion is separated from modeling** so that data source outages (a common problem with IMD/NCMRWF servers) don't take down the API — the system serves last-known-good data with a staleness flag.
- **Regime classifier is a standalone service** because it has a different retraining cadence (seasonal re-tuning) than the correction engine (which may need daily/weekly recalibration).
- **Verification is decoupled from serving** — it runs as a batch/scheduled job against archived forecasts vs. observations, not on the live request path.

---

## 2. Real, Public Data Sources

All of the following are genuinely public and scriptable today. This is the actual data layer to build against; restricted-data upgrade paths are noted separately in Section 2.4.

### 2.1 NWP Forecast Data (raw forecast to be corrected)

| Source | Access | Resolution | Notes |
|---|---|---|---|
| **NOAA GFS** | Open Data on AWS: `s3://noaa-gfs-bdp-pds/` (no auth) | 0.25° global, 6-hourly | Best free global NWP; use GRIB2 via `pygrib` or `cfgrib`/`xarray` |
| **ECMWF Open Data** | `pip install ecmwf-opendata`, free API | 0.25° global, 6-hourly | HRES + ENS (ensemble) — ensemble spread is valuable for heavy-rain probability |
| **NCMRWF GFS-T1534 / GEFS** | NCMRWF NWP data portal (registration, free for research) | 12 km over India | Best India-specific NWP if you register |
| **IMD** | IMD data supply portal (registration; some free for research/academic use) | Various | District rainfall forecasts, observed gridded rainfall |

**Recommended default for the buildable prototype:** GFS via AWS Open Data (zero friction, no auth, no rate limits) + ECMWF Open Data for ensemble spread.

### 2.2 Observed/"Ground Truth" Rainfall Data (for training correction models and verification)

| Source | Access | Resolution | Notes |
|---|---|---|---|
| **IMD Gridded Rainfall** | IMD Pune (registration; widely used in academic work, 0.25°) | 0.25° daily, India | Gold standard for India; check current access terms |
| **GPM IMERG (NASA)** | `earthaccess` Python package / NASA Earthdata (free account) | 0.1°, 30-min & daily | Fully public, satellite-based, good proxy for observed rainfall where IMD gridded is unavailable |
| **CHIRPS** | `https://data.chc.ucsb.edu/products/CHIRPS-2.0/` (direct download, no auth) | 0.05° daily | Fully open, no registration at all — good fallback for prototype development |
| **ERA5 reanalysis precipitation** | Copernicus CDS API (`cdsapi`, free account) | 0.25° hourly | Not truly "observed" but widely used as a reanalysis-based truth proxy |

**Recommended default:** CHIRPS for zero-friction prototyping (no auth needed at all), IMERG as a secondary/validation source, IMD gridded as the upgrade path once registered.

### 2.3 Regime-Index / Predictor Data

| Variable | Source | Access |
|---|---|---|
| MSLP, 850/700/200 hPa wind, geopotential height | ERA5 (Copernicus CDS) | `cdsapi`, free |
| OLR (outgoing longwave radiation) | NOAA OLR dataset | `https://psl.noaa.gov/data/gridded/data.olrcdr.interp.html`, direct download |
| PWAT / TCWV (precipitable water) | ERA5 | `cdsapi` |
| MJO index (phase, amplitude) | BOM Australia | `http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt` — plain text, no auth |
| Monsoon trough position / LPS tracks | IMD RSMC New Delhi best-track archive | Public PDF/CSV bulletins — needs light parsing |
| Active/Break monsoon dates (historical, for label bootstrapping) | Published IMD/IITM research (Rajeevan et al. index), reconstructible from rainfall anomaly over monsoon core zone using ERA5/CHIRPS | Computed, not directly downloaded |

### 2.4 Where Restricted Data Would Materially Help (documented upgrade path)

- **IMD district-level rainfall** (operational, quality-controlled) — better verification ground truth than IMERG/CHIRPS over data-sparse hill/coastal regions.
- **NCMRWF ensemble NWP at 12 km** — much better base forecast skill over India's complex terrain than global 0.25° GFS/ECMWF, directly improving both the raw baseline and the correction quality.
- **IMD AWS/ARG station network** — sub-daily, point-verified rainfall for calibrating extreme/heavy-rain probability models, which gridded products systematically smooth out.
- **Real-time active/break monsoon bulletin** — removes the need to reconstruct regime labels heuristically, improving classifier label quality directly.

Design the ingestion layer with a source-adapter pattern (Section 3.1) specifically so these can be swapped in later without touching downstream modules.

---

## 3. Backend Design (Modular)

### 3.1 Module: Data Ingestion (`ingestion/`)

**Pattern:** Each data source implements a common adapter interface so sources are interchangeable.

```python
# ingestion/base.py
from abc import ABC, abstractmethod
import xarray as xr

class DataSourceAdapter(ABC):
    """Common interface all data sources must implement."""

    @abstractmethod
    def fetch(self, date_range: tuple, bbox: tuple) -> xr.Dataset:
        """Returns data as a standardized xarray Dataset with dims
        (time, lat, lon) and CF-compliant variable names."""
        ...

    @abstractmethod
    def source_metadata(self) -> dict:
        """Returns {name, resolution, latency, license, last_updated}."""
        ...


class GFSAdapter(DataSourceAdapter):
    def fetch(self, date_range, bbox):
        # pull from s3://noaa-gfs-bdp-pds/, decode GRIB2 with cfgrib
        ...

class CHIRPSAdapter(DataSourceAdapter):
    def fetch(self, date_range, bbox):
        # direct HTTP download from data.chc.ucsb.edu, decode NetCDF/tif
        ...

class ERA5Adapter(DataSourceAdapter):
    def fetch(self, date_range, bbox):
        # cdsapi request, decode NetCDF
        ...
```

All fetched data is normalized to a **standard internal schema**:

```
Dataset dims: (time, lat, lon)
Required variables: precip_mm, source_name, forecast_lead_hours (nullable for obs)
Coordinate reference: WGS84, lat -90..90, lon 0..360 or -180..180 (documented, pick one and enforce)
```

Raw pulls are cached to **Parquet (for tabular/district-level) and NetCDF/Zarr (for gridded)** on object storage (S3-compatible — works with AWS S3, MinIO for self-hosted, or local disk for prototype). A metadata table (Postgres) tracks what's been fetched, avoiding redundant downloads.

**Scheduling:** Airflow or a simple cron + Python script for the prototype (Airflow is overkill until you have >3-4 real pipelines running).

### 3.2 Module: Feature Engineering (`features/`)

Computes regime indices and grid/district-level predictor tables from raw ingested data. Pure functions, unit-testable, no I/O side effects beyond reading from the ingestion cache.

Key outputs:
- `regime_index_table`: one row per day, columns = [MT_lat, MT_lon, LLJ_speed, OLR_anom, PWAT, MJO_phase, MJO_amp, LPS_flag, WD_flag, ...]
- `grid_predictor_table`: one row per (time, lat, lon), columns = [raw_nwp_precip, elevation, dist_to_coast, terrain_slope, regime_prob_vector, lag1_precip, ...]
- `district_lookup`: static table mapping grid cells → district polygons (use IMD/Survey of India shapefiles or `geoBoundaries`/`GADM` India admin-2 boundaries — both public)

### 3.3 Module: Regime Classifier (`regime_classifier/`)

Deployed as its own microservice/model artifact (e.g., `regime_model.pkl` or a saved PyTorch checkpoint) with a thin inference wrapper:

```python
# regime_classifier/service.py
class RegimeClassifier:
    def predict(self, index_window: pd.DataFrame) -> dict:
        """index_window: last N days of regime_index_table.
        Returns: {regime: str, probabilities: {regime_name: float, ...}}"""
        ...
```

Formulas and model details in Section 4.

### 3.4 Module: Bias Correction Engine (`correction/`)

```python
# correction/engine.py
class RegimeConditionedCorrector:
    def __init__(self, models_by_regime: dict):
        self.models = models_by_regime  # {regime_name: fitted model}

    def correct(self, raw_forecast: np.ndarray, regime_probs: dict, covariates: pd.DataFrame) -> np.ndarray:
        """Probability-weighted blend across regime-specific corrections
        rather than a hard switch — see Section 5.3 for the blending formula."""
        ...
```

### 3.5 Module: Heavy Rainfall Probability (`extremes/`)

```python
# extremes/model.py
class HeavyRainProbabilityModel:
    def predict_proba(self, corrected_forecast, ensemble_spread, regime_probs) -> dict:
        """Returns {threshold_mm: probability} for each operational threshold
        (e.g. 64.5, 115.5, 204.5 per IMD categories)."""
        ...
```

### 3.6 Module: Verification (`verification/`)

Batch job, not on the live request path. Formulas in Section 6. Writes results to a `verification_results` table keyed by (date, regime, threshold, metric_name, model_name).

### 3.7 Module: API Layer (`api/`)

**Framework: FastAPI** (async, auto-generates OpenAPI schema the frontend can codegen against, good performance for I/O-bound geospatial queries).

```
GET  /api/v1/regime/current                → current regime + probabilities
GET  /api/v1/regime/history?start=&end=    → historical regime timeline
GET  /api/v1/forecast/grid?date=&lead=      → corrected grid forecast (GeoJSON/array)
GET  /api/v1/forecast/district?date=&lead=  → district-level table
GET  /api/v1/forecast/heavy-rain-prob?date=&threshold=
GET  /api/v1/verification/summary?regime=&metric=&period=
GET  /api/v1/verification/timeseries?metric=&regime=
WS   /api/v1/live                           → push updates when new forecast cycle lands
```

Response schemas defined with **Pydantic models**, shared between backend validation and auto-generated frontend TypeScript types (via `openapi-typescript` codegen) — this is the concrete mechanism for scalable frontend/backend integration: the frontend never hand-writes types that can drift from the backend.

### 3.8 Data Layer

- **Postgres + PostGIS**: district boundaries, metadata, verification results, regime history (relational, needs geospatial queries)
- **Object storage (S3/MinIO)**: raw and processed gridded data (NetCDF/Zarr), model artifacts
- **Redis**: cache layer for hot API responses (current forecast, current regime) — short TTL matched to forecast cycle frequency (6h)

### 3.9 Deployment/Scaling Notes

- Each module above is a separate Docker container; orchestrate with Docker Compose for prototype, Kubernetes when scaling to production (separate deployments let the GPU-bound correction/classifier services scale independently from the lightweight API layer).
- Put the classifier and correction inference behind a model-serving layer (e.g., a simple FastAPI wrapper is fine at this scale; move to something like BentoML/TorchServe only if request volume grows significantly).
- Horizontal scaling point: the API layer and Redis cache are stateless and trivially replicated; the ingestion and verification jobs are scheduled batch, not request-driven, so they scale by schedule frequency, not by replica count.

---

## 4. Regime Classifier — Formulas & Model Spec

### 4.1 Regime Index Definitions

**Monsoon Trough Position (proxy for active/break):**
Track the latitude of minimum MSLP along 75°–85°E in the 15°N–30°N band:

```
MT_lat(t) = argmin_lat [ MSLP(lat, lon=75-85E, t) ]
```

Active monsoon: trough near its normal position (~ 21–23°N) with a well-developed low-level jet.
Break monsoon: trough shifted north toward the Himalayan foothills (>26°N), rainfall over core monsoon zone (18–28°N, 73–86°E) suppressed.

**Break Monsoon Index (Rajeevan et al.-style), standardized rainfall anomaly over the monsoon core zone (MCZ):**

```
BMI(t) = [ P_MCZ(t) - P̄_MCZ_clim ] / σ_MCZ_clim
```

where `P_MCZ(t)` is the area-averaged daily rainfall over the MCZ, and `P̄_MCZ_clim`, `σ_MCZ_clim` are the climatological mean and standard deviation for that calendar day (computed from a multi-year baseline, e.g. 1991–2020).

Classification rule of thumb (used for bootstrap labeling, refined by the ML classifier):
```
BMI(t) ≤ -1.0   for ≥ 2 consecutive days  → break monsoon
BMI(t) ≥ +1.0   for ≥ 2 consecutive days  → active monsoon
otherwise                                  → normal/transition
```

**Low-Level Jet (LLJ) Index:**

```
LLJ(t) = mean wind speed at 850 hPa over box [5-15°N, 70-80°E]
```//
LLJ > ~12–15 m/s is characteristic of active monsoon spells.

**Low Pressure System (LPS) / Depression flag:**
Boolean, from RSMC best-track archive: 1 if a monitored LPS center is within the domain on day `t`, with intensity sub-classified by RSMC's standard categories (well-marked low, depression, deep depression, cyclonic storm).

**Western Disturbance (WD) flag:**
Boolean, from 500 hPa trough detection over 60–80°E, 25–40°N in the extended winter/pre-monsoon season, cross-checked against IMD WD bulletins where available.

**Orographic/Coastal flags:**
Static, not time-varying — assigned per grid cell/district from terrain data:
```
is_orographic(grid) = elevation(grid) > 500m AND terrain_slope(grid) > threshold
is_coastal(grid)    = distance_to_coastline(grid) < 50 km
```
These act as **conditioning features**, not standalone temporal regimes — a coastal grid cell can simultaneously be "in" an active monsoon regime.

**MJO conditioning:**
```
MJO_phase(t) ∈ {1..8}, MJO_amplitude(t) = sqrt(RMM1² + RMM2²)
```
Used as an auxiliary predictor (MJO phases 2-3 and 6-7 are statistically associated with active/break transitions over India — treat as a feature, not a hard rule).

### 4.2 Classifier Model

**Recommended architecture:** Gradient-boosted trees (XGBoost) as the primary/default model — strong performance on tabular meteorological indices, fast to train/retrain, interpretable via SHAP values (useful to justify regime attributions operationally). A sequence model is an optional upgrade path.

**Input feature vector** (per day `t`, using a trailing window):
```
X(t) = [ BMI(t), BMI(t-1), BMI(t-2),
         MT_lat(t), MT_lat(t-1),
         LLJ(t), LLJ(t-1),
         OLR_anom(t),
         PWAT(t),
         MJO_phase(t), MJO_amplitude(t),
         LPS_flag(t), LPS_intensity(t),
         WD_flag(t),
         day_of_year_sin, day_of_year_cos ]
```

**Output:** softmax probability vector over `K` regime classes:
```
P(regime = k | X(t)) = softmax(f_θ(X(t)))_k,   k ∈ {active, break, depression, WD, normal}
```

**Loss function (training):**
```
L = - Σ_t Σ_k  y_k(t) · log( P(regime=k | X(t)) )        (categorical cross-entropy)
```
with class weighting inversely proportional to class frequency (regimes like "depression" are rare and will otherwise be starved of gradient signal):
```
w_k = N_total / (K · N_k)
```

**Optional sequence upgrade (LSTM/Transformer):** same input features but fed as a (window_length × n_features) tensor; use when transition-timing accuracy (not just single-day classification) matters, since regimes persist over multi-day spells and a sequence model captures that persistence structure explicitly.

**Bootstrapped label construction** (since fully labeled regime datasets don't exist publicly): combine the rule-based `BMI`/`LLJ`/`LPS_flag`/`WD_flag` thresholds above into an initial label set, manually spot-check a sample against IMD monsoon bulletins/press releases (which qualitatively describe active/break spells in text), correct mislabeled cases, then train the classifier on this corrected set. This is standard practice for domains without a canonical labeled dataset — document the labeling rule precisely so it is auditable and reproducible.

---

## 5. Bias Correction — Formulas & Model Spec

### 5.1 Quantile Mapping (baseline, per regime)

For each regime `k`, grid cell (or district) `g`, and season `s`, fit the empirical CDF of raw forecast vs. observed rainfall using historical paired data conditioned on days classified as regime `k`:

```
F_obs,k,g(x) = empirical CDF of observed rainfall, regime k, location g
F_fcst,k,g(x) = empirical CDF of raw forecast rainfall, regime k, location g

Corrected value:
P_corrected = F_obs,k,g^(-1) ( F_fcst,k,g( P_raw ) )
```

In practice, fit both CDFs via a smoothed empirical quantile function (e.g., 100 quantile bins with linear interpolation between them; use a gamma or mixed gamma-Gumbel parametric fit if data volume per regime/location is thin, since rainfall distributions are strongly right-skewed with excess zeros).

**Handling the zero-rainfall spike:** rainfall distributions have a large point mass at zero. Use a two-part model:
```
P(rain > 0) modeled separately (logistic regression on same predictors)
Given rain > 0, apply quantile mapping on the continuous positive-rainfall distribution
```

### 5.2 ML-Based Correction (XGBoost regression, recommended default)

**Target:** predict the additive correction (bias residual), not the absolute rainfall value — this is more stable and degrades gracefully:

```
residual(t, g) = P_obs(t, g) - P_raw_nwp(t, g)

f_θ : X(t,g) → residual_hat(t,g)

P_corrected(t,g) = P_raw_nwp(t,g) + residual_hat(t,g)
```

**Feature vector:**
```
X(t, g) = [ P_raw_nwp(t, g),
            regime_probs(t) (vector, from Section 4),
            elevation(g), dist_to_coast(g), terrain_slope(g),
            lead_time_hours,
            P_raw_nwp at 8 surrounding grid cells (spatial context),
            lag1_observed_precip(g),
            ensemble_spread(t, g)  if using ECMWF ENS/GEFS ]
```

**Loss function:** Rainfall-appropriate — plain MSE over-penalizes heavy-rain misses being averaged away. Use a **weighted MSE** that upweights heavy-rainfall cases:
```
L = (1/N) Σ_i  w_i · ( residual_hat_i - residual_true_i )²

w_i = 1 + α · 1[ P_obs,i > heavy_threshold ]     (α tuned, e.g. 2-4)
```
or train separate models per rainfall-intensity band and blend, if a single model underfits extremes.

**Train one model per regime** (`f_θ_active`, `f_θ_break`, `f_θ_depression`, ...), each trained only on days/locations classified into that regime.

### 5.3 Regime-Probability-Weighted Blending

To avoid discontinuities at regime-transition boundaries (a day classified 55% active / 45% break shouldn't jump discretely between two corrections), blend regime-specific corrected outputs by classifier probability:

```
P_corrected_final(t,g) = Σ_k  P(regime=k | X(t)) · P_corrected,k(t,g)
```

where `P_corrected,k` is the output of the regime-`k`-specific correction model (Section 5.2) applied uniformly (i.e., every regime model scores every case, and outputs are probability-weighted).

### 5.4 Spatial Correction Upgrade Path (ConvLSTM / U-Net)

For grid-to-grid spatial correction capturing terrain-induced bias structure (e.g., systematic underestimation on windward Ghats slopes):

```
Input tensor: (C, H, W) where C = [raw_nwp_precip, elevation, regime_prob_maps (K channels), ...]
Output tensor: (H, W) = corrected precip field

Loss: pixelwise weighted MSE (as in 5.2) + optional FSS-based loss term
      to directly optimize for the spatial verification metric:

L_FSS-aware = λ1 · L_MSE + λ2 · (1 - FSS_neighborhood(pred, obs))
```
This is a genuine upgrade, not required for the initial buildable version — flag as Phase 2.

---

## 6. Heavy Rainfall Probability — Formulas & Model Spec

### 6.1 Operational Thresholds (IMD standard categories)

| Category | 24h rainfall (mm) |
|---|---|
| Light | 0.1 – 15.5 |
| Moderate | 15.6 – 64.4 |
| Heavy | 64.5 – 115.5 |
| Very Heavy | 115.6 – 204.4 |
| Extremely Heavy | ≥ 204.5 |

### 6.2 Probability Model

For each threshold `τ ∈ {64.5, 115.5, 204.5}`, train a binary classifier:

```
y_τ(t,g) = 1[ P_obs(t,g) ≥ τ ]

P(y_τ = 1 | X(t,g)) = sigmoid( f_θ_τ(X(t,g)) )
```

**Feature vector**, extending the correction feature set with distributional/uncertainty signal:
```
X(t,g) = [ P_corrected(t,g),
           regime_probs(t),
           ensemble_spread(t,g),          # std dev across ECMWF ENS / GEFS members
           ensemble_max(t,g),
           terrain features,
           climatological P95/P99 of rainfall at g for this calendar week ]
```

**Loss:** binary cross-entropy, again class-weighted since exceedance events are rare:
```
L = - (1/N) Σ_i [ w_pos · y_i log(p_i) + (1-y_i) log(1-p_i) ]
w_pos = N_neg / N_pos    (inverse frequency weighting)
```

### 6.3 Probability Calibration

Raw classifier probabilities for rare events are typically miscalibrated (over- or under-confident). Apply **isotonic regression** as a post-hoc calibration step:

```
p_calibrated = IsotonicRegression.fit(p_raw_on_holdout, y_true_on_holdout).predict(p_raw)
```

Verify calibration with a **reliability diagram**: bin forecast probabilities into deciles, plot mean forecast probability vs. observed frequency within each bin; a well-calibrated model lies on the 1:1 diagonal.

---

## 7. Verification Module — Formulas

All metrics computed **stratified by regime** and, where applicable, **by rainfall threshold**, comparing raw NWP vs. AI-corrected output against observed rainfall.

### 7.1 Continuous Metrics

**RMSE:**
```
RMSE = sqrt( (1/N) Σ (P_forecast,i - P_obs,i)² )
```

**MAE:**
```
MAE = (1/N) Σ | P_forecast,i - P_obs,i |
```

**Mean Bias:**
```
Bias = (1/N) Σ ( P_forecast,i - P_obs,i )
```

**Correlation coefficient:**
```
r = Σ( (P_f,i - P̄_f)(P_o,i - P̄_o) )  /  sqrt( Σ(P_f,i - P̄_f)² · Σ(P_o,i - P̄_o)² )
```

### 7.2 Categorical (Contingency-Table) Metrics

For a given rainfall threshold `τ`, build the 2×2 contingency table:

| | Observed ≥ τ | Observed < τ |
|---|---|---|
| **Forecast ≥ τ** | Hits (H) | False Alarms (F) |
| **Forecast < τ** | Misses (M) | Correct Negatives (CN) |

**Probability of Detection (POD):**
```
POD = H / (H + M)              range [0,1], higher is better
```

**False Alarm Ratio (FAR):**
```
FAR = F / (H + F)              range [0,1], lower is better
```

**Critical Success Index (CSI, a.k.a. Threat Score):**
```
CSI = H / (H + M + F)          range [0,1], higher is better
```

**Equitable Threat Score (ETS):**
```
H_random = (H + M)(H + F) / N        where N = H + M + F + CN

ETS = (H - H_random) / (H + M + F - H_random)
```
ETS corrects CSI for hits expected by chance — this is the standard skill-vs-climatology comparator and should be the headline categorical metric in the report.

**Heidke Skill Score (optional, supplementary):**
```
HSS = 2(H·CN - M·F) / [ (H+M)(M+CN) + (H+F)(F+CN) ]
```

### 7.3 Spatial Metric: Fractions Skill Score (FSS)

FSS evaluates spatial pattern match at a chosen neighborhood scale `n` (in grid cells), which is essential for rainfall since exact grid-cell-level matching is an unreasonably strict standard for convective/orographic rainfall.

For neighborhood size `n×n`, compute the fraction of exceedance within each neighborhood window for both forecast and observed fields:
```
FRAC_fcst(x,y; n) = (1/n²) Σ_{i,j ∈ window(x,y,n)} 1[ P_fcst(i,j) ≥ τ ]
FRAC_obs(x,y; n)  = (1/n²) Σ_{i,j ∈ window(x,y,n)} 1[ P_obs(i,j) ≥ τ ]

FBS (Fractions Brier Score) = (1/N_windows) Σ ( FRAC_fcst - FRAC_obs )²

FBS_worst = (1/N_windows) [ Σ FRAC_fcst² + Σ FRAC_obs² ]

FSS(n) = 1 - FBS / FBS_worst          range [0,1], higher is better
```

Compute FSS across a range of neighborhood sizes (e.g., n = 1, 3, 5, 9, 15 grid cells) and report the **FSS(n) curve** — the neighborhood scale at which FSS crosses ~0.5 is often reported as the "useful skill scale" of the forecast.

### 7.4 Reporting Structure

The verification report should present, for each regime and each lead time:
1. A table: RMSE, MAE, Bias, r — raw vs. corrected, side by side, with % improvement.
2. A table: POD, FAR, CSI, ETS at each threshold (light/moderate/heavy/very heavy) — raw vs. corrected.
3. An FSS(n) curve plot — raw vs. corrected — per regime.
4. A reliability diagram for the heavy-rain probability model.
5. A summary statement per regime: does regime-aware correction outperform a single global correction model on the same metrics? (This comparison — regime-aware vs. global-single-model — is the core empirical claim of the whole project and should be run as an explicit ablation, not asserted.)

---

## 8. Frontend Design (Scalable)

### 8.1 Stack

- **React + TypeScript** (Vite build tooling — faster dev loop than CRA)
- **State/data fetching:** TanStack Query (React Query) — handles caching, refetch-on-interval (matches the 6-hourly forecast cycle), and loading/error states cleanly against the FastAPI backend
- **Mapping:** MapLibre GL JS (open-source, no vendor lock-in/API-key cost unlike Google Maps or Mapbox) for the district choropleth, with vector tiles served from the backend (PostGIS → `pg_tileserv` or `martin` for on-the-fly MVT tile generation — scales far better than pre-rendering static GeoJSON for every forecast cycle)
- **Charts:** Recharts or D3 for verification plots (FSS curves, reliability diagrams, skill-score bar charts)
- **Types:** auto-generated from the backend's OpenAPI schema via `openapi-typescript`, so frontend types can never silently drift from backend response shapes

### 8.2 Component Architecture

```
src/
  api/              generated TS client + React Query hooks
  components/
    RegimeIndicator/       current regime badge + probability breakdown
    DistrictMap/           MapLibre choropleth, district click → detail panel
    DistrictTable/         sortable/filterable data table (rainfall, category, heavy-rain prob)
    ForecastTimeline/      lead-time selector, regime history strip
    VerificationDashboard/
      SkillScoreTable/     RMSE/ETS/CSI/POD/FAR table, raw vs corrected
      FSSCurveChart/
      ReliabilityDiagram/
  pages/
    Dashboard.tsx          main operational view
    Verification.tsx       skill report view
    DistrictDetail.tsx     drill-down per district
  hooks/            useCurrentRegime, useDistrictForecast, useVerificationSummary
```

### 8.3 Scalability Mechanisms (concrete, not aspirational)

- **Vector tiles, not raw GeoJSON**, for the district map — this is what actually lets the map scale from "demo with 10 districts" to "all 700+ Indian districts, every forecast cycle" without the browser choking on payload size.
- **Server-side pagination/filtering** on the district table endpoint (`?page=&limit=&sort=&regime=`) rather than shipping the full national table to the client.
- **React Query's stale-while-revalidate** caching means the dashboard feels instant on repeat visits while still picking up new forecast cycles automatically (poll interval matched to the known 6-hourly NWP cycle, not aggressive constant polling).
- **Code-splitting per route** (`Dashboard`, `Verification`, `DistrictDetail` as separate lazy-loaded chunks) so the verification module's charting libraries don't bloat the initial load of the operational dashboard.
- **WebSocket channel** (`/api/v1/live`) for push-based "new forecast cycle available" notification, avoiding wasteful polling across many simultaneous users.

---

## 9. Build Phasing (Recommended Order)

| Phase | Scope |
|---|---|
| **Phase 0** | Ingestion adapters for GFS + CHIRPS + ERA5; district boundary data loaded into PostGIS |
| **Phase 1** | Regime index computation (Section 4.1) + rule-based bootstrap labels; XGBoost regime classifier (Section 4.2) |
| **Phase 2** | Quantile-mapping baseline correction (Section 5.1) — simplest correct end-to-end pipeline, gives a working baseline to beat |
| **Phase 3** | XGBoost regime-conditioned correction (Section 5.2–5.3) — the actual novel contribution |
| **Phase 4** | Heavy-rain probability model (Section 6) + calibration |
| **Phase 5** | Verification module (Section 7) — run raw-vs-corrected-vs-global-single-model ablation |
| **Phase 6** | FastAPI layer + district/grid endpoints |
| **Phase 7** | React frontend — dashboard, map, table, verification views |
| **Phase 8 (optional)** | ConvLSTM/U-Net spatial correction upgrade; IMD/NCMRWF restricted-data integration if access secured |

---

## 10. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| No canonical labeled regime dataset exists | Documented rule-based bootstrap labeling (Section 4.2), spot-checked against IMD bulletins; treat classifier accuracy on this as a known limitation to report honestly, not hide |
| Public rainfall products (CHIRPS/IMERG) have known biases in Himalayan/NE terrain | Use as prototype-stage ground truth only; document explicitly as a limitation; design ingestion adapter pattern so IMD gridded data is a drop-in replacement later |
| Heavy-rain events are rare → class imbalance in every downstream model | Class-weighted losses (Sections 4.2, 5.2, 6.2) throughout; report skill scores stratified by threshold so heavy-rain performance isn't averaged away by the much larger no-rain/light-rain sample |
| Regime transitions are gradual, not discrete | Probability-weighted blending (Section 5.3) instead of hard regime switching |
| Data source outages (common with government NWP portals) | Ingestion layer caches last-known-good data with explicit staleness flags surfaced to the frontend, rather than failing silently |
