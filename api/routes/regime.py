"""Regime classification endpoints."""

from fastapi import APIRouter

from api.mock_data import mock_regime_current, mock_regime_history
from shared.schemas import RegimeOutput

router = APIRouter()


@router.get("/current", response_model=RegimeOutput)
def get_current_regime():
    """Get the current monsoon regime classification with probabilities."""
    return mock_regime_current()


@router.get("/history", response_model=list[RegimeOutput])
def get_regime_history(start: str = "2023-06-01", end: str = "2023-09-30"):
    """Get historical regime timeline for a date range."""
    return mock_regime_history(start, end)
