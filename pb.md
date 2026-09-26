# 🅱️ Person B — API, Database & Frontend

> **Branch:** `feature/api-frontend`
> **Your domain:** Docker infra → FastAPI API → React dashboard with map, tables, charts
> **Person A is building:** Data ingestion + ML pipeline on `feature/data-pipeline` — you'll use mock data until Hour 10, then swap in their real outputs

---

## Shared Contract (Agree with Person A at Hour 0)

> [!IMPORTANT]
> You and Person A **must** spend the first 30 minutes together creating `shared/schemas.py` and the directory structure. This is the interface contract — if these drift, integration at Hour 10 will fail.

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
├── ingestion/              ← ❌ Person A's territory
├── features/               ← ❌ Person A's territory
├── regime_classifier/      ← ❌ Person A's territory
├── correction/             ← ❌ Person A's territory
├── extremes/               ← ❌ Person A's territory
├── verification/           ← ❌ Person A's territory (you expose it via API)
├── api/                    ← ✅ YOURS
│   ├── main.py
│   ├── mock_data.py
│   ├── dependencies.py
│   └── routes/
│       ├── regime.py
│       ├── forecast.py
│       ├── verification.py
│       └── districts.py
├── frontend/               ← ✅ YOURS
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml      ← ✅ YOURS
├── data/                   ← ❌ Person A's territory (gitignored)
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
git checkout -b feature/api-frontend
```

**Merge rules:**
- Work exclusively on `feature/api-frontend`
- Only edit files in `api/`, `frontend/`, `docker-compose.yml`
- `shared/` changes → tell Person A, get agreement, then push
- At Hour 10: Person A merges first, then you rebase on top:
  ```bash
  git fetch origin
  git rebase origin/main
  ```

---

## Environment Setup

**Backend (Terminal 1):**
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Frontend (Terminal 2):**
```bash
cd frontend
npm install
npm run dev
```

**Docker (Terminal 3):**
```bash
docker-compose up -d
```

**`requirements.txt` (your additions):**
```
# API
fastapi>=0.100
uvicorn[standard]
pydantic>=2.0
redis
asyncpg
sqlalchemy
geoalchemy2

# Shared
pydantic>=2.0
```

---

## Hour-by-Hour Execution Plan

---

### ⏱️ Hour 0–0.5 — Shared Setup (WITH Person A)

- [ ] Create directory structure (full tree above)
- [ ] Write `shared/schemas.py` together
- [ ] Write `shared/config.py` together
- [ ] Write `requirements.txt` together
- [ ] Set up `docker-compose.yml`:

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: regime_sih
      POSTGRES_USER: regime
      POSTGRES_PASSWORD: regime_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

- [ ] `docker-compose up -d`, verify both services healthy
- [ ] Commit: `"chore: initial project structure + shared schemas + docker-compose"`
- [ ] Push, both pull from main, then branch off

**🔑 Exit criteria:** Person A can import from `shared/schemas.py` on their machine.

---

### ⏱️ Hours 0.5–3 — FastAPI Backend with Mock Data

**Goal:** Full API layer returning realistic mock data so you can build the frontend immediately without waiting for Person A's ML pipeline.

#### `api/mock_data.py` — Realistic Mock Data Generator

> [!TIP]
> Invest 30 min here making the mock data convincing. Use real Indian district names, plausible rainfall values, and realistic regime probabilities. This makes the frontend look impressive even before real ML data is wired in.

```python
"""Realistic mock data for development. Will be replaced by real pipeline at Hour 10."""
import random
from datetime import datetime, timedelta
from shared.schemas import RegimeOutput, DistrictForecast, VerificationSummary
from shared.config import REGIME_CLASSES, IMD_THRESHOLDS

# Real district data (subset — expand to 50+ for demo)
SAMPLE_DISTRICTS = [
    {"id": "IN-MH-MU", "name": "Mumbai", "state": "Maharashtra", "lat": 19.08, "lon": 72.88},
    {"id": "IN-DL-ND", "name": "New Delhi", "state": "Delhi", "lat": 28.61, "lon": 77.21},
    {"id": "IN-KA-BG", "name": "Bengaluru", "state": "Karnataka", "lat": 12.97, "lon": 77.59},
    {"id": "IN-WB-KO", "name": "Kolkata", "state": "West Bengal", "lat": 22.57, "lon": 88.36},
    {"id": "IN-TN-CH", "name": "Chennai", "state": "Tamil Nadu", "lat": 13.08, "lon": 80.27},
    {"id": "IN-RJ-JP", "name": "Jaipur", "state": "Rajasthan", "lat": 26.91, "lon": 75.79},
    {"id": "IN-KL-TV", "name": "Thiruvananthapuram", "state": "Kerala", "lat": 8.52, "lon": 76.94},
    {"id": "IN-AS-GU", "name": "Guwahati", "state": "Assam", "lat": 26.14, "lon": 91.74},
    {"id": "IN-GJ-AH", "name": "Ahmedabad", "state": "Gujarat", "lat": 23.02, "lon": 72.57},
    {"id": "IN-UP-LK", "name": "Lucknow", "state": "Uttar Pradesh", "lat": 26.85, "lon": 80.95},
    {"id": "IN-MP-BH", "name": "Bhopal", "state": "Madhya Pradesh", "lat": 23.26, "lon": 77.41},
    {"id": "IN-MH-PU", "name": "Pune", "state": "Maharashtra", "lat": 18.52, "lon": 73.86},
    {"id": "IN-HR-CH", "name": "Chandigarh", "state": "Haryana", "lat": 30.73, "lon": 76.78},
    {"id": "IN-JH-RA", "name": "Ranchi", "state": "Jharkhand", "lat": 23.34, "lon": 85.31},
    {"id": "IN-OR-BH", "name": "Bhubaneswar", "state": "Odisha", "lat": 20.30, "lon": 85.82},
    {"id": "IN-GA-PA", "name": "Panaji", "state": "Goa", "lat": 15.50, "lon": 73.83},
    {"id": "IN-UK-DE", "name": "Dehradun", "state": "Uttarakhand", "lat": 30.32, "lon": 78.03},
    {"id": "IN-SK-GA", "name": "Gangtok", "state": "Sikkim", "lat": 27.33, "lon": 88.62},
    {"id": "IN-ML-SH", "name": "Shillong", "state": "Meghalaya", "lat": 25.57, "lon": 91.88},
    {"id": "IN-MN-IM", "name": "Imphal", "state": "Manipur", "lat": 24.82, "lon": 93.95},
]

def categorize_rainfall(mm: float) -> str:
    for cat, (lo, hi) in IMD_THRESHOLDS.items():
        if lo <= mm <= hi:
            return cat
    return "light" if mm < 0.1 else "extremely_heavy"

def mock_regime_current() -> RegimeOutput:
    regime = random.choice(["active", "active", "normal", "break", "depression"])
    probs = {r: random.uniform(0.02, 0.15) for r in REGIME_CLASSES}
    probs[regime] = random.uniform(0.45, 0.85)
    total = sum(probs.values())
    probs = {k: round(v / total, 3) for k, v in probs.items()}
    return RegimeOutput(date=datetime.now(), regime=regime, probabilities=probs)

def mock_district_forecasts(lead_hours: int = 24) -> list[DistrictForecast]:
    regime = mock_regime_current()
    forecasts = []
    for d in SAMPLE_DISTRICTS:
        raw = max(0, random.gauss(25, 30))
        correction = random.gauss(-3, 8)
        corrected = max(0, raw + correction)
        forecasts.append(DistrictForecast(
            district_id=d["id"], district_name=d["name"],
            state=d["state"], lat=d["lat"], lon=d["lon"],
            date=datetime.now(), lead_hours=lead_hours,
            raw_precip_mm=round(raw, 1),
            corrected_precip_mm=round(corrected, 1),
            regime=regime.regime,
            regime_confidence=regime.probabilities[regime.regime],
            heavy_rain_prob_65mm=round(random.uniform(0, 0.5), 3) if corrected > 30 else round(random.uniform(0, 0.1), 3),
            heavy_rain_prob_115mm=round(random.uniform(0, 0.2), 3) if corrected > 60 else round(random.uniform(0, 0.03), 3),
            category=categorize_rainfall(corrected)
        ))
    return forecasts

def mock_verification_summary(regime: str = "active") -> VerificationSummary:
    return VerificationSummary(
        regime=regime,
        period_start=datetime(2023, 6, 1),
        period_end=datetime(2023, 9, 30),
        rmse_raw=round(random.uniform(15, 25), 1),
        rmse_corrected=round(random.uniform(8, 16), 1),
        mae_raw=round(random.uniform(10, 18), 1),
        mae_corrected=round(random.uniform(5, 12), 1),
        ets_by_threshold={
            "15.5": {"raw": round(random.uniform(0.15, 0.3), 3), "corrected": round(random.uniform(0.25, 0.45), 3)},
            "64.5": {"raw": round(random.uniform(0.05, 0.15), 3), "corrected": round(random.uniform(0.12, 0.28), 3)},
            "115.5": {"raw": round(random.uniform(0.01, 0.08), 3), "corrected": round(random.uniform(0.05, 0.15), 3)},
        }
    )
```

#### `api/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import regime, forecast, verification, districts

app = FastAPI(
    title="Regime-SIH API",
    description="Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(regime.router, prefix="/api/v1/regime", tags=["Regime"])
app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["Forecast"])
app.include_router(verification.router, prefix="/api/v1/verification", tags=["Verification"])
app.include_router(districts.router, prefix="/api/v1/districts", tags=["Districts"])

@app.get("/api/v1/health")
def health():
    return {"status": "ok", "data_source": "mock"}  # Change to "live" at integration
```

#### `api/routes/regime.py`

```python
from fastapi import APIRouter
from api.mock_data import mock_regime_current
from shared.schemas import RegimeOutput

router = APIRouter()

@router.get("/current", response_model=RegimeOutput)
def get_current_regime():
    return mock_regime_current()

@router.get("/history")
def get_regime_history(start: str = "2023-06-01", end: str = "2023-09-30"):
    # Return a list of daily RegimeOutputs for the timeline component
    ...
```

#### `api/routes/forecast.py`

```python
from fastapi import APIRouter, Query
from api.mock_data import mock_district_forecasts
from shared.schemas import DistrictForecast

router = APIRouter()

@router.get("/district", response_model=list[DistrictForecast])
def get_district_forecast(
    date: str = Query(None),
    lead: int = Query(24, description="Lead time in hours")
):
    return mock_district_forecasts(lead)

@router.get("/grid")
def get_grid_forecast(date: str = Query(None), lead: int = Query(24)):
    # Return mock grid data
    ...

@router.get("/heavy-rain-prob")
def get_heavy_rain_prob(date: str = Query(None), threshold: float = Query(64.5)):
    # Return per-district heavy rain probabilities
    ...
```

#### `api/routes/verification.py`

```python
from fastapi import APIRouter, Query
from api.mock_data import mock_verification_summary

router = APIRouter()

@router.get("/summary")
def get_verification_summary(regime: str = Query("active")):
    return mock_verification_summary(regime)
```

#### `api/routes/districts.py`

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/geojson")
def get_district_geojson():
    """Serve India district boundaries as GeoJSON.
    Source: GADM India admin-2 or geoBoundaries."""
    # Load and return GeoJSON file
    # For now, return a simplified version
    ...
```

**Run the API:**
```bash
uvicorn api.main:app --reload --port 8000
```

**Verify:** `curl http://localhost:8000/api/v1/regime/current` should return valid JSON matching `RegimeOutput`.

**Commit at Hour 3:** `"feat: FastAPI backend with realistic mock data for all endpoints"`

---

### 🔄 Sync Point — Hour 3 (10 min)

> Quick check with Person A:
> - "API is returning mock data on all endpoints — here's the Swagger docs at `/docs`"
> - "Any changes to the shared schemas?"
> - "Is your data downloading OK?"

---

### ⏱️ Hours 3–5 — Frontend Scaffold + Design System

**Goal:** Vite + React + TypeScript app with a premium dark-mode design system that looks stunning.

#### Scaffold

```bash
cd regime-sih
npx -y create-vite@latest frontend --template react-ts
cd frontend
npm install maplibre-gl react-map-gl recharts @tanstack/react-query axios
npm install -D @types/maplibre-gl
```

#### `frontend/src/index.css` — Premium Design System

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

:root {
  /* Base palette — deep ocean dark mode */
  --bg-primary: #060b18;
  --bg-secondary: #0a1128;
  --bg-card: rgba(16, 30, 62, 0.6);
  --bg-card-hover: rgba(22, 42, 82, 0.7);

  /* Glassmorphism */
  --glass-bg: rgba(16, 30, 62, 0.45);
  --glass-border: rgba(79, 195, 247, 0.12);
  --glass-blur: 20px;

  /* Accent colors — monsoon palette */
  --accent-primary: #4fc3f7;
  --accent-secondary: #29b6f6;
  --accent-glow: rgba(79, 195, 247, 0.25);
  --accent-green: #66bb6a;
  --accent-orange: #ffa726;
  --accent-red: #ef5350;
  --accent-purple: #ab47bc;

  /* Regime-specific colors */
  --regime-active: #4fc3f7;
  --regime-break: #ffa726;
  --regime-depression: #ef5350;
  --regime-wd: #ab47bc;
  --regime-normal: #66bb6a;

  /* Rainfall category colors */
  --rain-light: #81c784;
  --rain-moderate: #4fc3f7;
  --rain-heavy: #ffa726;
  --rain-very-heavy: #ff7043;
  --rain-extreme: #ef5350;

  /* Text */
  --text-primary: #e8eaf6;
  --text-secondary: rgba(232, 234, 246, 0.6);
  --text-muted: rgba(232, 234, 246, 0.35);

  /* Spacing */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-smooth: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-spring: 500ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

/* ===== Glassmorphism Card ===== */
.glass-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  padding: 24px;
  transition: all var(--transition-smooth);
}

.glass-card:hover {
  background: var(--bg-card-hover);
  border-color: rgba(79, 195, 247, 0.25);
  box-shadow: 0 8px 32px rgba(79, 195, 247, 0.08);
  transform: translateY(-2px);
}

/* ===== Regime Badge ===== */
.regime-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  animation: pulse-glow 2s ease-in-out infinite;
}

.regime-badge.active { background: rgba(79, 195, 247, 0.15); color: var(--regime-active); border: 1px solid rgba(79, 195, 247, 0.3); }
.regime-badge.break { background: rgba(255, 167, 38, 0.15); color: var(--regime-break); border: 1px solid rgba(255, 167, 38, 0.3); }
.regime-badge.depression { background: rgba(239, 83, 80, 0.15); color: var(--regime-depression); border: 1px solid rgba(239, 83, 80, 0.3); }
.regime-badge.western_disturbance { background: rgba(171, 71, 188, 0.15); color: var(--regime-wd); border: 1px solid rgba(171, 71, 188, 0.3); }
.regime-badge.normal { background: rgba(102, 187, 106, 0.15); color: var(--regime-normal); border: 1px solid rgba(102, 187, 106, 0.3); }

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 8px currentColor; opacity: 1; }
  50% { box-shadow: 0 0 20px currentColor; opacity: 0.9; }
}

/* ===== Category Pills ===== */
.category-pill {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.category-pill.light { background: rgba(129, 199, 132, 0.15); color: var(--rain-light); }
.category-pill.moderate { background: rgba(79, 195, 247, 0.15); color: var(--rain-moderate); }
.category-pill.heavy { background: rgba(255, 167, 38, 0.15); color: var(--rain-heavy); }
.category-pill.very_heavy { background: rgba(255, 112, 67, 0.15); color: var(--rain-very-heavy); }
.category-pill.extremely_heavy { background: rgba(239, 83, 80, 0.15); color: var(--rain-extreme); }

/* ===== Data Table ===== */
.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.875rem;
}

.data-table thead th {
  background: rgba(79, 195, 247, 0.06);
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--glass-border);
  position: sticky;
  top: 0;
  cursor: pointer;
}

.data-table tbody tr {
  transition: background var(--transition-fast);
}

.data-table tbody tr:hover {
  background: rgba(79, 195, 247, 0.06);
}

.data-table tbody td {
  padding: 10px 16px;
  border-bottom: 1px solid rgba(79, 195, 247, 0.05);
  color: var(--text-primary);
}

/* ===== Sidebar Navigation ===== */
.sidebar {
  position: fixed;
  left: 0;
  top: 0;
  width: 72px;
  height: 100vh;
  background: var(--bg-secondary);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  gap: 8px;
  z-index: 100;
}

.sidebar-item {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 1.25rem;
  border: none;
  background: none;
}

.sidebar-item:hover,
.sidebar-item.active {
  background: var(--accent-glow);
  color: var(--accent-primary);
}

/* ===== Stat Card ===== */
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-card .label {
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-card .value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-card .change {
  font-size: 0.8rem;
  font-weight: 500;
}

.stat-card .change.positive { color: var(--accent-green); }
.stat-card .change.negative { color: var(--accent-red); }

/* ===== Layout ===== */
.main-content {
  margin-left: 72px;
  padding: 24px 32px;
  min-height: 100vh;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.page-header p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
.grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }

/* ===== Animations ===== */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in {
  animation: fadeInUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.animate-in:nth-child(1) { animation-delay: 0ms; }
.animate-in:nth-child(2) { animation-delay: 80ms; }
.animate-in:nth-child(3) { animation-delay: 160ms; }
.animate-in:nth-child(4) { animation-delay: 240ms; }

/* ===== Loading Skeleton ===== */
.skeleton {
  background: linear-gradient(90deg, var(--bg-card) 25%, rgba(79, 195, 247, 0.08) 50%, var(--bg-card) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== Scrollbar ===== */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(79, 195, 247, 0.2); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(79, 195, 247, 0.4); }
```

#### `frontend/src/api/client.ts`

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  timeout: 10000,
});

export interface RegimeOutput {
  date: string;
  regime: 'active' | 'break' | 'depression' | 'western_disturbance' | 'normal';
  probabilities: Record<string, number>;
}

export interface DistrictForecast {
  district_id: string;
  district_name: string;
  state: string;
  lat: number;
  lon: number;
  date: string;
  lead_hours: number;
  raw_precip_mm: number;
  corrected_precip_mm: number;
  regime: string;
  regime_confidence: number;
  heavy_rain_prob_65mm: number | null;
  heavy_rain_prob_115mm: number | null;
  category: string;
}

export interface VerificationSummary {
  regime: string;
  period_start: string;
  period_end: string;
  rmse_raw: number;
  rmse_corrected: number;
  mae_raw: number;
  mae_corrected: number;
  ets_by_threshold: Record<string, Record<string, number>>;
}

export const fetchCurrentRegime = () => api.get<RegimeOutput>('/regime/current');
export const fetchRegimeHistory = (start: string, end: string) =>
  api.get<RegimeOutput[]>('/regime/history', { params: { start, end } });
export const fetchDistrictForecast = (lead: number = 24) =>
  api.get<DistrictForecast[]>('/forecast/district', { params: { lead } });
export const fetchVerificationSummary = (regime: string) =>
  api.get<VerificationSummary>('/verification/summary', { params: { regime } });

export default api;
```

#### `frontend/src/hooks/useData.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchCurrentRegime, fetchDistrictForecast, fetchVerificationSummary } from '../api/client';

export const useCurrentRegime = () =>
  useQuery({ queryKey: ['regime', 'current'], queryFn: () => fetchCurrentRegime().then(r => r.data), refetchInterval: 60000 });

export const useDistrictForecast = (lead: number = 24) =>
  useQuery({ queryKey: ['forecast', 'district', lead], queryFn: () => fetchDistrictForecast(lead).then(r => r.data) });

export const useVerificationSummary = (regime: string) =>
  useQuery({ queryKey: ['verification', regime], queryFn: () => fetchVerificationSummary(regime).then(r => r.data) });
```

#### `frontend/src/App.tsx`

```tsx
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard';
import Verification from './pages/Verification';
import './index.css';

const queryClient = new QueryClient();

function App() {
  const [page, setPage] = useState<'dashboard' | 'verification'>('dashboard');

  return (
    <QueryClientProvider client={queryClient}>
      <nav className="sidebar">
        <div style={{ fontSize: '1.5rem', marginBottom: '24px' }}>🌧️</div>
        <button className={`sidebar-item ${page === 'dashboard' ? 'active' : ''}`}
                onClick={() => setPage('dashboard')} title="Dashboard">📊</button>
        <button className={`sidebar-item ${page === 'verification' ? 'active' : ''}`}
                onClick={() => setPage('verification')} title="Verification">✅</button>
      </nav>
      <main className="main-content">
        {page === 'dashboard' && <Dashboard />}
        {page === 'verification' && <Verification />}
      </main>
    </QueryClientProvider>
  );
}

export default App;
```

**Commit at Hour 5:** `"feat: frontend scaffold + design system + API hooks"`

---

### ⏱️ Hours 5–8 — Dashboard Page (The Money Shot)

**Goal:** The main operational view that will impress — map + regime + table.

> [!IMPORTANT]
> This is the most visually important page. Spend time making it look premium. A stunning dashboard with mock data is worth more than a broken dashboard with real data.

Build these components:

#### 1. `RegimeIndicator` Component
- Large glassmorphism card at the top
- Shows current regime with animated badge (e.g., "🌧️ ACTIVE MONSOON" in blue)
- Horizontal stacked bar showing probability breakdown across all 5 regimes
- Confidence percentage with animated count-up effect
- Subtle pulse animation on the badge

#### 2. `DistrictMap` Component (MapLibre GL)
- Full-width map of India
- Choropleth fill colored by `corrected_precip_mm` (green → yellow → orange → red gradient)
- District boundaries rendered from GeoJSON
- Click a district → popup showing forecast details
- Color scale legend overlay
- Use map style: `https://demotiles.maplibre.org/style.json` or a dark basemap

```tsx
// Simplified MapLibre setup
import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// India center: [78.9629, 20.5937], zoom ~4.5
```

> [!TIP]
> **For the district GeoJSON:** Download India admin-2 from [geoBoundaries](https://www.geoboundaries.org/index.html#getdata) or [GADM](https://gadm.org/download_country.html). Place in `frontend/public/india_districts.geojson`. Simplify geometry with `mapshaper` if the file is too large (>5MB).

#### 3. `DistrictTable` Component
- Sortable columns: District, State, Raw (mm), Corrected (mm), Δ%, Heavy Rain %, Category
- Category shown as colored pills (`.category-pill` CSS class)
- Correction improvement shown as green/red percentage
- Click row → highlight on map (shared state via React context or URL params)
- Search bar to filter by district/state name

#### 4. `ForecastTimeline` Component
- Horizontal row of lead-time buttons: T+6h, T+12h, T+24h, T+48h, T+72h
- Selected lead-time controls what data the map and table show
- Below: a regime history strip — colored horizontal bars showing regime transitions over the past 30 days

#### Dashboard Layout
```
┌──────────────────────────────────────────────────┐
│ [Header] Regime-SIH Dashboard    [Regime Badge]  │
├────────────┬─────────────────────────────────────┤
│            │                                     │
│  District  │         India Choropleth Map        │
│  Table     │         (MapLibre GL)               │
│  (sorted,  │                                     │
│  filtered) │                                     │
│            │                                     │
├────────────┴─────────────────────────────────────┤
│ [T+6h] [T+12h] [T+24h] [T+48h] [T+72h]         │
│ ████████████░░░░░░░░████████ regime timeline     │
└──────────────────────────────────────────────────┘
```

**Commit at Hour 8:** `"feat: dashboard page — regime indicator, district map, forecast table"`

---

### 🔄 Sync Point — Hour 6 (15 min)

> Check with Person A:
> - "Dashboard is rendering with mock data — here's a screenshot"
> - "My API response shapes match RegimeOutput and DistrictForecast exactly"
> - "What will your real output look like? Any extra fields?"

---

### ⏱️ Hours 8–10 — Verification Page + Polish

#### `Verification` Page Components

##### 1. `SkillScoreTable`
- Side-by-side comparison: Raw NWP vs. AI-Corrected
- Metrics: RMSE, MAE, Mean Bias, Correlation
- Improvement % column, color-coded green
- Dropdown to filter by regime

##### 2. `CategoricalMetricsChart` (Recharts)
- Grouped bar chart: POD, FAR, CSI, ETS at each threshold
- Light / Moderate / Heavy / Very Heavy groups
- Raw (grey bars) vs. Corrected (blue bars)

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
```

##### 3. `FSSCurveChart` (Recharts)
- Line chart: X = neighborhood size, Y = FSS value
- Two lines: Raw (dashed grey) vs. Corrected (solid blue)
- Horizontal dashed line at FSS = 0.5 ("useful skill" threshold)

##### 4. `ReliabilityDiagram` (Recharts)
- Scatter plot: X = forecast probability bin, Y = observed frequency
- Diagonal 1:1 reference line
- Histogram of sample counts per bin as secondary axis

#### Verification Layout
```
┌──────────────────────────────────────────────────┐
│ Verification Report         [Regime: dropdown ▼] │
├──────────────────────────────────────────────────┤
│ ┌──── Skill Scores ────┐ ┌── Categorical ──────┐ │
│ │ RMSE  Raw  Corrected │ │                     │ │
│ │ MAE   ...  ...       │ │  Grouped Bar Chart  │ │
│ │ Bias  ...  ...       │ │  POD/FAR/CSI/ETS    │ │
│ │ r     ...  ...       │ │                     │ │
│ └──────────────────────┘ └─────────────────────┘ │
│ ┌──── FSS Curve ───────┐ ┌── Reliability ──────┐ │
│ │                      │ │                     │ │
│ │  Line chart          │ │  Scatter + diagonal │ │
│ │  raw vs corrected    │ │                     │ │
│ └──────────────────────┘ └─────────────────────┘ │
└──────────────────────────────────────────────────┘
```

#### Polish Tasks (remaining time)
- [ ] Loading skeletons (`.skeleton` CSS class) for all data-dependent components
- [ ] Error states with retry buttons
- [ ] Card entrance animations (`.animate-in` CSS class)
- [ ] Number count-up animations for stat values
- [ ] Map zoom transitions when switching lead times
- [ ] Responsive: stack table below map on narrow screens

**Commit at Hour 10:** `"feat: verification page + UI polish + animations"`

---

### 🔄 Sync Point — Hour 9 (15 min)

> Pre-integration check:
> - "I have dashboard + verification pages fully working with mocks"
> - "Show me a sample JSON output from your pipeline — I'll verify it parses"
> - Plan integration: "I'll update `api/routes/*.py` to import your services instead of mock_data"

---

### ⏱️ Hours 10–12 — Integration with Person A 🤝

> [!CAUTION]
> This is the most critical window. You and Person A work together. Person A's branch merges first.

**Step 1: Rebase on Person A's merged code**
```bash
git fetch origin
git rebase origin/main
# Resolve any conflicts (should be minimal since you own different directories)
```

**Step 2: Replace mock data with real pipeline calls**

Update each route file to import from Person A's modules instead of `mock_data.py`:

```python
# api/routes/regime.py — BEFORE (mock)
from api.mock_data import mock_regime_current

# api/routes/regime.py — AFTER (real)
from regime_classifier.service import RegimeClassifier
classifier = RegimeClassifier("data/models/regime_classifier.pkl")

@router.get("/current")
def get_current_regime():
    # Load latest regime index data
    # return classifier.predict(latest_index_window)
    ...
```

Do this for each route:
- [ ] `/regime/current` → `RegimeClassifier.predict()`
- [ ] `/forecast/district` → `RegimeConditionedCorrector.correct()` + district aggregation
- [ ] `/forecast/heavy-rain-prob` → `HeavyRainProbabilityModel.predict_proba()`
- [ ] `/verification/summary` → `verification.metrics.run_verification()`

**Step 3: Test end-to-end**
- [ ] API returns real data that matches the same schemas
- [ ] Frontend renders without errors
- [ ] Map shows actual rainfall patterns
- [ ] Regime badge reflects real classifier output

**Step 4: Update health endpoint**
```python
@app.get("/api/v1/health")
def health():
    return {"status": "ok", "data_source": "live"}  # ← Changed from "mock"
```

**Step 5: Final merge**
```bash
git add .
git commit -m "feat: integrate real ML pipeline into API — live data flowing"
git checkout main
git merge feature/api-frontend
git push
```

---

## Fallback Strategy

> [!WARNING]
> If Person A's pipeline isn't ready at Hour 10, **keep the mock data** and present the demo with mocks. A polished dashboard with realistic fake data is far more impressive than a broken dashboard with half-working real data.

**Fallback plan:**
1. Keep `api/mock_data.py` as the data source
2. Add a banner: "🔬 Demo Mode — Simulated Data" at the top of the dashboard
3. Add a toggle switch: "Mock Data / Live Data" (disabled, showing mock is active)
4. This is still a valid and impressive demo

---

## Component Checklist (Final Review)

| Component | Location | Status |
|---|---|---|
| Design System (CSS) | `frontend/src/index.css` | |
| API Client + Types | `frontend/src/api/client.ts` | |
| React Query Hooks | `frontend/src/hooks/useData.ts` | |
| App Shell + Navigation | `frontend/src/App.tsx` | |
| Regime Indicator | `frontend/src/components/RegimeIndicator.tsx` | |
| District Map | `frontend/src/components/DistrictMap.tsx` | |
| District Table | `frontend/src/components/DistrictTable.tsx` | |
| Forecast Timeline | `frontend/src/components/ForecastTimeline.tsx` | |
| Dashboard Page | `frontend/src/pages/Dashboard.tsx` | |
| Skill Score Table | `frontend/src/components/SkillScoreTable.tsx` | |
| Categorical Chart | `frontend/src/components/CategoricalMetricsChart.tsx` | |
| FSS Curve Chart | `frontend/src/components/FSSCurveChart.tsx` | |
| Reliability Diagram | `frontend/src/components/ReliabilityDiagram.tsx` | |
| Verification Page | `frontend/src/pages/Verification.tsx` | |
| FastAPI Main | `api/main.py` | |
| Mock Data | `api/mock_data.py` | |
| Regime Routes | `api/routes/regime.py` | |
| Forecast Routes | `api/routes/forecast.py` | |
| Verification Routes | `api/routes/verification.py` | |
| District Routes | `api/routes/districts.py` | |
| Docker Compose | `docker-compose.yml` | |
