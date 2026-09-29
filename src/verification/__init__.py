"""Verification module — Skill scores for rainfall forecast evaluation.

Implements the six mandatory verification metrics from the SIH problem statement:
    RMSE  — Root Mean Square Error (continuous)
    ETS   — Equitable Threat Score (categorical)
    CSI   — Critical Success Index (categorical)
    POD   — Probability of Detection (categorical)
    FAR   — False Alarm Ratio (categorical)
    FSS   — Fractions Skill Score (neighbourhood-based)

All categorical scores use the standard 2×2 contingency table:

                    Observed ≥ T    Observed < T
    Forecast ≥ T       Hits (a)     False Alarms (b)
    Forecast < T       Misses (c)   Correct Negatives (d)

References:
    Wilks, D.S. (2011). Statistical Methods in the Atmospheric Sciences. 3rd ed.
    Roberts, N. & Lean, H. (2008). Scale-selective verification of rainfall
        accumulations from high-resolution forecasts. Mon. Wea. Rev., 136, 78–97.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import Sequence

# IMD operational rainfall thresholds (mm / 24h)
IMD_THRESHOLDS = {
    "light":            (2.5, 15.5),
    "moderate":         (15.6, 64.4),
    "heavy":            (64.5, 115.5),
    "very_heavy":       (115.6, 204.4),
    "extremely_heavy":  (204.5, float("inf")),
}

DEFAULT_THRESHOLDS_MM = [15.5, 64.5, 115.5, 204.5]


# ---------------------------------------------------------------------------
# Contingency table
# ---------------------------------------------------------------------------
@dataclass
class ContingencyTable:
    """2×2 contingency table for a single threshold."""
    threshold_mm: float
    hits: int = 0          # a
    false_alarms: int = 0  # b
    misses: int = 0        # c
    correct_neg: int = 0   # d

    @property
    def total(self) -> int:
        return self.hits + self.false_alarms + self.misses + self.correct_neg

    @classmethod
    def from_arrays(
        cls,
        observed: np.ndarray,
        forecast: np.ndarray,
        threshold: float,
    ) -> "ContingencyTable":
        obs_yes = observed >= threshold
        fct_yes = forecast >= threshold
        return cls(
            threshold_mm=threshold,
            hits=int(np.sum(fct_yes & obs_yes)),
            false_alarms=int(np.sum(fct_yes & ~obs_yes)),
            misses=int(np.sum(~fct_yes & obs_yes)),
            correct_neg=int(np.sum(~fct_yes & ~obs_yes)),
        )


# ---------------------------------------------------------------------------
# Individual metric functions
# ---------------------------------------------------------------------------
def rmse(observed: np.ndarray, forecast: np.ndarray) -> float:
    """Root Mean Square Error (mm)."""
    return float(np.sqrt(np.mean((forecast - observed) ** 2)))


def mae(observed: np.ndarray, forecast: np.ndarray) -> float:
    """Mean Absolute Error (mm)."""
    return float(np.mean(np.abs(forecast - observed)))


def bias_ratio(observed: np.ndarray, forecast: np.ndarray) -> float:
    """Multiplicative bias (forecast / observed mean). 1.0 = perfect."""
    obs_mean = np.mean(observed)
    return float(np.mean(forecast) / obs_mean) if obs_mean > 0 else float("nan")


def pod(ct: ContingencyTable) -> float:
    """Probability of Detection  =  a / (a + c).  Range [0, 1]."""
    denom = ct.hits + ct.misses
    return ct.hits / denom if denom > 0 else float("nan")


def far(ct: ContingencyTable) -> float:
    """False Alarm Ratio  =  b / (a + b).  Range [0, 1]."""
    denom = ct.hits + ct.false_alarms
    return ct.false_alarms / denom if denom > 0 else float("nan")


def csi(ct: ContingencyTable) -> float:
    """Critical Success Index (Threat Score)  =  a / (a + b + c).  Range [0, 1]."""
    denom = ct.hits + ct.false_alarms + ct.misses
    return ct.hits / denom if denom > 0 else float("nan")


def ets(ct: ContingencyTable) -> float:
    """Equitable Threat Score (Gilbert Skill Score).

    ETS = (a - a_ref) / (a + b + c - a_ref)
    where a_ref = (a+b)(a+c) / N  (hits expected by random chance).
    Range [-1/3, 1].  0 = no skill over random.
    """
    n = ct.total
    if n == 0:
        return float("nan")
    a_ref = (ct.hits + ct.false_alarms) * (ct.hits + ct.misses) / n
    denom = ct.hits + ct.false_alarms + ct.misses - a_ref
    return (ct.hits - a_ref) / denom if denom > 0 else float("nan")


def frequency_bias(ct: ContingencyTable) -> float:
    """Frequency Bias  =  (a + b) / (a + c).  1.0 = unbiased."""
    denom = ct.hits + ct.misses
    return (ct.hits + ct.false_alarms) / denom if denom > 0 else float("nan")


def hss(ct: ContingencyTable) -> float:
    """Heidke Skill Score.

    HSS = 2(ad - bc) / [(a+c)(c+d) + (a+b)(b+d)]
    Range [-1, 1].  0 = no skill over random.
    """
    num = 2 * (ct.hits * ct.correct_neg - ct.false_alarms * ct.misses)
    denom = (
        (ct.hits + ct.misses) * (ct.misses + ct.correct_neg)
        + (ct.hits + ct.false_alarms) * (ct.false_alarms + ct.correct_neg)
    )
    return num / denom if denom > 0 else float("nan")


# ---------------------------------------------------------------------------
# Fractions Skill Score (FSS)
# ---------------------------------------------------------------------------
def _fraction_field(binary: np.ndarray, radius: int) -> np.ndarray:
    """Compute fraction of '1's in a square neighbourhood of given radius.

    Uses a uniform box filter via cumulative sums for O(N) per-pixel cost.
    """
    from scipy.ndimage import uniform_filter
    return uniform_filter(binary.astype(float), size=2 * radius + 1, mode="constant")


def fss(
    observed_2d: np.ndarray,
    forecast_2d: np.ndarray,
    threshold: float,
    radius: int = 5,
) -> float:
    """Fractions Skill Score (Roberts & Lean 2008).

    Compares spatial fractions of exceedance within a neighbourhood window.
    FSS = 1 - FBS / FBS_ref
    where FBS  = mean( (O_frac - F_frac)^2 )
          FBS_ref = mean(O_frac^2) + mean(F_frac^2)

    Args:
        observed_2d:  2-D grid of observed rainfall (mm).
        forecast_2d:  2-D grid of forecast rainfall (mm), same shape.
        threshold:    Rainfall threshold (mm) to binarise the fields.
        radius:       Neighbourhood half-width in grid cells.

    Returns:
        FSS value in [0, 1].  1 = perfect spatial match.
    """
    if observed_2d.shape != forecast_2d.shape:
        raise ValueError("Observed and forecast grids must have the same shape.")

    obs_bin = (observed_2d >= threshold).astype(float)
    fct_bin = (forecast_2d >= threshold).astype(float)

    obs_frac = _fraction_field(obs_bin, radius)
    fct_frac = _fraction_field(fct_bin, radius)

    fbs = float(np.mean((obs_frac - fct_frac) ** 2))
    fbs_ref = float(np.mean(obs_frac ** 2) + np.mean(fct_frac ** 2))

    return 1.0 - fbs / fbs_ref if fbs_ref > 0 else float("nan")


# ---------------------------------------------------------------------------
# Aggregate report
# ---------------------------------------------------------------------------
@dataclass
class VerificationReport:
    """Complete verification report for one regime or time-slice."""
    regime: str
    n_samples: int
    rmse_raw: float
    rmse_corrected: float
    mae_raw: float
    mae_corrected: float
    bias_raw: float
    bias_corrected: float
    categorical: dict[float, dict] = field(default_factory=dict)
    # categorical[threshold_mm] = {pod, far, csi, ets, hss, freq_bias}

    def to_dict(self) -> dict:
        out = {
            "regime": self.regime,
            "n_samples": self.n_samples,
            "rmse_raw": round(self.rmse_raw, 3),
            "rmse_corrected": round(self.rmse_corrected, 3),
            "mae_raw": round(self.mae_raw, 3),
            "mae_corrected": round(self.mae_corrected, 3),
            "bias_raw": round(self.bias_raw, 3),
            "bias_corrected": round(self.bias_corrected, 3),
            "categorical": {},
        }
        for thr, scores in self.categorical.items():
            out["categorical"][str(thr)] = {
                k: round(v, 3) if not np.isnan(v) else None
                for k, v in scores.items()
            }
        return out

    def summary_text(self) -> str:
        lines = [
            f"=== Verification Report — Regime: {self.regime} ({self.n_samples} samples) ===",
            f"  RMSE   — Raw: {self.rmse_raw:.2f} mm  |  Corrected: {self.rmse_corrected:.2f} mm",
            f"  MAE    — Raw: {self.mae_raw:.2f} mm  |  Corrected: {self.mae_corrected:.2f} mm",
            f"  Bias   — Raw: {self.bias_raw:.3f}     |  Corrected: {self.bias_corrected:.3f}",
            "",
        ]
        for thr, scores in sorted(self.categorical.items()):
            lines.append(f"  Threshold ≥ {thr} mm:")
            for metric, val in scores.items():
                val_str = f"{val:.3f}" if not np.isnan(val) else "N/A"
                lines.append(f"    {metric:12s} = {val_str}")
            lines.append("")
        return "\n".join(lines)


def compute_verification(
    observed: np.ndarray,
    raw_forecast: np.ndarray,
    corrected_forecast: np.ndarray,
    regime: str = "all",
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS_MM,
) -> VerificationReport:
    """Compute full verification report comparing raw NWP vs ML-corrected output.

    Args:
        observed:            1-D array of observed rainfall (mm).
        raw_forecast:        1-D array of raw NWP rainfall (mm).
        corrected_forecast:  1-D array of ML bias-corrected rainfall (mm).
        regime:              Regime label for this verification slice.
        thresholds:          Rainfall thresholds for categorical scores.

    Returns:
        VerificationReport with all six SIH-mandated metrics.
    """
    obs = np.asarray(observed, dtype=float)
    raw = np.asarray(raw_forecast, dtype=float)
    cor = np.asarray(corrected_forecast, dtype=float)

    report = VerificationReport(
        regime=regime,
        n_samples=len(obs),
        rmse_raw=rmse(obs, raw),
        rmse_corrected=rmse(obs, cor),
        mae_raw=mae(obs, raw),
        mae_corrected=mae(obs, cor),
        bias_raw=bias_ratio(obs, raw),
        bias_corrected=bias_ratio(obs, cor),
    )

    for thr in thresholds:
        ct_raw = ContingencyTable.from_arrays(obs, raw, thr)
        ct_cor = ContingencyTable.from_arrays(obs, cor, thr)

        report.categorical[thr] = {
            "POD_raw":          pod(ct_raw),
            "POD_corrected":    pod(ct_cor),
            "FAR_raw":          far(ct_raw),
            "FAR_corrected":    far(ct_cor),
            "CSI_raw":          csi(ct_raw),
            "CSI_corrected":    csi(ct_cor),
            "ETS_raw":          ets(ct_raw),
            "ETS_corrected":    ets(ct_cor),
            "HSS_raw":          hss(ct_raw),
            "HSS_corrected":    hss(ct_cor),
            "Freq_Bias_raw":    frequency_bias(ct_raw),
            "Freq_Bias_corrected": frequency_bias(ct_cor),
        }

    return report


def compute_regime_stratified_verification(
    df: pd.DataFrame,
    obs_col: str = "observed",
    raw_col: str = "raw_nwp",
    cor_col: str = "corrected",
    regime_col: str = "regime",
    thresholds: Sequence[float] = DEFAULT_THRESHOLDS_MM,
) -> list[VerificationReport]:
    """Compute verification reports stratified by weather regime.

    Args:
        df:  DataFrame with columns for observed, raw, corrected, and regime.

    Returns:
        List of VerificationReport, one per unique regime + one for 'all'.
    """
    reports = []

    # Overall
    reports.append(compute_verification(
        df[obs_col].values, df[raw_col].values, df[cor_col].values,
        regime="all", thresholds=thresholds,
    ))

    # Per regime
    for regime_name, group in df.groupby(regime_col):
        if len(group) < 10:
            continue
        reports.append(compute_verification(
            group[obs_col].values, group[raw_col].values, group[cor_col].values,
            regime=str(regime_name), thresholds=thresholds,
        ))

    return reports
