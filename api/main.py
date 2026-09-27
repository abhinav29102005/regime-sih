"""Regime-SIH FastAPI Application.
Async, auto-generates OpenAPI schema for frontend type codegen.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import regime, forecast, verification, districts

cors_origins = os.getenv("CORS_ORIGINS")
if cors_origins is None:
    cors_origins = ",".join(
        [
            "https://meghdrishti.abhinavkumarsingh.tech",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ]
    )

app = FastAPI(
    title="Regime-SIH API",
    description="Regime-Aware AI Post-Processing of Monsoon Rainfall Forecasts",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins.split(",") if origin.strip()],
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
    return {"status": "ok", "data_source": "database", "version": "0.1.0"}
