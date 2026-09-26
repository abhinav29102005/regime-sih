from dotenv import load_dotenv
load_dotenv()
"""
Database Client and Data Fetching Logic.
(Previously mock_data.py, now 100% database-driven!)
"""
import os
from datetime import datetime, timedelta
import random
import libsql_client

from shared.schemas import RegimeOutput, DistrictForecast, VerificationSummary

URL = os.environ.get("TURSO_URL", "https://meghdhrishti-abhinav29102005.aws-ap-northeast-1.turso.io")
TOKEN = os.environ.get("TURSO_TOKEN", "")

def get_db_client():
    return libsql_client.create_client_sync(url=URL, auth_token=TOKEN)

def fetch_regime_current() -> RegimeOutput:
    """Fetch the most recent regime from the database."""
    try:
        client = get_db_client()
        # Get the latest entry
        rs = client.execute("SELECT * FROM regime_history ORDER BY date DESC LIMIT 1")
        if not rs.rows:
            raise Exception("No data in regime_history")
            
        row = rs.rows[0]
        date_obj = datetime.strptime(row[0], "%Y-%m-%d")
        probs = {
            "active": row[2],
            "break": row[3],
            "depression": row[4],
            "western_disturbance": row[5],
            "normal": row[6]
        }
        return RegimeOutput(date=date_obj, regime=row[1], probabilities=probs)
    except Exception as e:
        print(f"Turso DB Error in regime_current: {e}")
        # Fallback if DB fails
        return RegimeOutput(date=datetime.now(), regime="normal", probabilities={"normal": 1.0})

def fetch_regime_history(start: str, end: str) -> list[RegimeOutput]:
    """Fetch historical regimes from the database."""
    try:
        client = get_db_client()
        rs = client.execute(
            "SELECT * FROM regime_history WHERE date >= ? AND date <= ? ORDER BY date ASC", 
            [start, end]
        )
        history = []
        for row in rs.rows:
            date_obj = datetime.strptime(row[0], "%Y-%m-%d")
            probs = {
                "active": row[2],
                "break": row[3],
                "depression": row[4],
                "western_disturbance": row[5],
                "normal": row[6]
            }
            history.append(RegimeOutput(date=date_obj, regime=row[1], probabilities=probs))
        return history
    except Exception as e:
        print(f"Turso DB Error in regime_history: {e}")
        return []

def fetch_district_forecasts(lead_hours: int = 24) -> list[DistrictForecast]:
    """Fetch real ML forecasts from the database."""
    regime = fetch_regime_current()
    try:
        client = get_db_client()
        rs = client.execute("SELECT * FROM district_forecasts")
        forecasts = []
        for row in rs.rows:
            forecasts.append(DistrictForecast(
                district_id=row[0],
                district_name=row[1],
                state=row[2],
                lat=row[3],
                lon=row[4],
                date=datetime.now(),
                lead_hours=lead_hours,
                raw_precip_mm=row[5],
                corrected_precip_mm=row[6],
                regime=regime.regime,
                regime_confidence=regime.probabilities.get(regime.regime, 1.0),
                heavy_rain_prob_65mm=row[7],
                heavy_rain_prob_115mm=row[8],
                category=row[9],
                temperature=row[10] if len(row) > 10 else None,
                humidity=row[11] if len(row) > 11 else None,
                wind_speed=row[12] if len(row) > 12 else None
            ))
        return forecasts
    except Exception as e:
        print(f"Turso DB Error in fetch_district_forecasts: {e}")
        return []

def fetch_verification_summary(regime: str = "active") -> VerificationSummary:
    """Fetch actual ML verification metrics from the database."""
    try:
        client = get_db_client()
        rs = client.execute("SELECT * FROM verification_metrics WHERE regime = ?", [regime])
        if not rs.rows:
            # Fallback to active if not found
            rs = client.execute("SELECT * FROM verification_metrics WHERE regime = 'active'")
            if not rs.rows:
                raise Exception("No data in verification_metrics")
                
        row = rs.rows[0]
        ets = {
            "15.5": {"raw": row[7], "corrected": row[8]},
            "64.5": {"raw": row[9], "corrected": row[10]},
            "115.5": {"raw": row[11], "corrected": row[12]}
        }
        
        return VerificationSummary(
            regime=row[0],
            period_start=datetime.strptime(row[1], "%Y-%m-%d"),
            period_end=datetime.strptime(row[2], "%Y-%m-%d"),
            rmse_raw=row[3],
            rmse_corrected=row[4],
            mae_raw=row[5],
            mae_corrected=row[6],
            ets_by_threshold=ets,
        )
    except Exception as e:
        print(f"Turso DB Error in verification_summary: {e}")
        return VerificationSummary(
            regime=regime,
            period_start=datetime.now(),
            period_end=datetime.now(),
            rmse_raw=0, rmse_corrected=0, mae_raw=0, mae_corrected=0,
            ets_by_threshold={}
        )
