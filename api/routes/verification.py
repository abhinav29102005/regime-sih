"""Verification / skill score endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Query

from api.database import VerificationMetricsNotFound, fetch_verification_summary
from shared.schemas import VerificationSummary

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/summary", response_model=VerificationSummary)
def get_verification_summary(
    regime: str = Query("active", description="Regime to filter verification by"),
):
    """Get verification metrics (raw vs corrected) for a regime."""
    try:
        return fetch_verification_summary(regime)
    except VerificationMetricsNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to fetch verification metrics for regime %s", regime)
        raise HTTPException(status_code=503, detail="Verification metrics are temporarily unavailable.") from exc
