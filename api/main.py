"""Regime-SIH FastAPI Application.
Async, auto-generates OpenAPI schema for frontend type codegen.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import regime, forecast, verification, districts

app = FastAPI(
    title="Regime-SIH API",
    description="Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # Fallback
        "http://127.0.0.1:5173",
    ],
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
    return {"status": "ok", "data_source": "mock", "version": "0.1.0"}
