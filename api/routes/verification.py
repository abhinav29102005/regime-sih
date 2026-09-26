"""Verification / skill score endpoints."""

from fastapi import APIRouter, Query

from api.database import fetch_verification_summary
from shared.schemas import VerificationSummary

router = APIRouter()


@router.get("/summary", response_model=VerificationSummary)
def get_verification_summary(
    regime: str = Query("active", description="Regime to filter verification by"),
):
    """Get verification metrics (raw vs corrected) for a regime."""
    return fetch_verification_summary(regime)
