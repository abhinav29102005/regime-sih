# 🅱️ Person B — Remaining Work

> **Branch:** `feature/api-frontend`
> **What's done:** Shared schemas, docker-compose, FastAPI with mock data (all routes), Vite+React+TS scaffold, design system CSS, API client + React Query hooks, Dashboard page (RegimeIndicator, DistrictTable, DistrictMap, lead-time selector), Verification page (skill scores table, ETS bar chart, FSS curve, reliability diagram).
> **What's left:** Listed below in priority order.

---

## ✅ DONE (already committed)

| File | Status |
|---|---|
| `shared/schemas.py` | ✅ Pydantic models (identical to PA) |
| `shared/config.py` | ✅ Constants, thresholds, paths |
| `docker-compose.yml` | ✅ PostGIS + Redis |
| `requirements.txt` | ✅ All Python deps |
| `api/main.py` | ✅ FastAPI app with CORS + routes |
| `api/mock_data.py` | ✅ Realistic mock data (40 districts, seeded RNG) |
| `api/routes/regime.py` | ✅ `/current` + `/history` |
| `api/routes/forecast.py` | ✅ `/district` + `/grid` + `/heavy-rain-prob` |
| `api/routes/verification.py` | ✅ `/summary` |
| `api/routes/districts.py` | ✅ `/geojson` |
| `frontend/src/index.css` | ✅ Full premium dark design system |
| `frontend/src/api/client.ts` | ✅ Axios + TypeScript types |
| `frontend/src/hooks/useData.ts` | ✅ React Query hooks |
| `frontend/src/App.tsx` | ✅ Sidebar nav + page routing |
| `frontend/src/components/RegimeIndicator.tsx` | ✅ Animated regime badge + probability bar |
| `frontend/src/components/DistrictTable.tsx` | ✅ Sortable/filterable table |
| `frontend/src/components/DistrictMap.tsx` | ✅ SVG dot map with color scale |
| `frontend/src/pages/Dashboard.tsx` | ✅ Stats row + lead selector + table + map |
| `frontend/src/pages/Verification.tsx` | ✅ Metrics table + ETS bars + FSS curve + reliability diagram |

---

## 🔲 TODO — Priority 1 (Must Have for Demo)

### 1. Upgrade DistrictMap to MapLibre GL (replace SVG dots)
- Install already done (`maplibre-gl`, `react-map-gl`)
- Download India admin-2 GeoJSON → `frontend/public/india_districts.geojson`
  - Source: https://www.geoboundaries.org/ or https://gadm.org/
  - Simplify with `mapshaper -simplify 10%` if >5MB
- Replace SVG dot map with real choropleth fill using `react-map-gl/maplibre`
- District click → popup with forecast details
- Dark basemap: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`

### 2. Loading & Error States
- Add `.skeleton` loading placeholders to all data-dependent sections
- Error states with retry buttons
- "No data" empty states

### 3. Polish Animations
- Card entrance: already has `.animate-in` CSS — ensure all cards use it
- Number count-up effect on stat values
- Smooth transitions when switching lead times (map zoom, table re-sort)

---

## 🔲 TODO — Priority 2 (Should Have)

### 4. Regime History Timeline Component
- Horizontal colored bar strip below lead-time selector
- Past 30 days, each day colored by regime
- Uses `useRegimeHistory` hook (already built)

### 5. WebSocket for Live Updates
- Add `WS /api/v1/live` endpoint to FastAPI
- Push "new forecast cycle available" notifications
- Frontend: reconnecting WebSocket hook, toast notification

### 6. Responsive Layout
- Stack table below map on screens <1200px
- Sidebar → bottom nav on mobile
- Touch-friendly map interactions

---

## 🔲 TODO — Priority 3 (Integration, Hour 10)

### 7. Replace Mock Data with Real Pipeline
When Person A merges `feature/data-pipeline` to main:

```bash
git fetch origin
git rebase origin/main
```

Then update each route to import from Person A's modules:

```python
# api/routes/regime.py — swap mock for real
from regime_classifier.service import RegimeClassifier
classifier = RegimeClassifier("data/models/regime_classifier.pkl")

@router.get("/current")
def get_current_regime():
    return classifier.predict(latest_index_window)
```

Routes to update:
- `/regime/current` → `RegimeClassifier.predict()`
- `/forecast/district` → `RegimeConditionedCorrector.correct()` + district agg
- `/forecast/heavy-rain-prob` → `HeavyRainProbabilityModel.predict_proba()`
- `/verification/summary` → `verification.metrics.run_verification()`

### 8. Update Health Endpoint
```python
return {"status": "ok", "data_source": "live"}  # Change from "mock"
```

---

## 🚀 Quick Start (for Person B on their laptop)

```bash
# Terminal 1: Database
docker-compose up -d

# Terminal 2: Backend API
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
# Verify: http://localhost:8000/docs

# Terminal 3: Frontend
cd frontend && npm install && npm run dev
# Opens: http://localhost:5173
```
