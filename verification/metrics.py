"""Verification metrics for raw vs corrected forecasts (Section 7).
Continuous, categorical, and spatial verification scores.
"""

import numpy as np
from scipy.ndimage import uniform_filter


# ---- Continuous metrics ----

def rmse(forecast: np.ndarray, observed: np.ndarray) -> float:
    return float(np.sqrt(np.mean((forecast - observed) ** 2)))


def mae(forecast: np.ndarray, observed: np.ndarray) -> float:
    return float(np.mean(np.abs(forecast - observed)))


def bias(forecast: np.ndarray, observed: np.ndarray) -> float:
    return float(np.mean(forecast - observed))


def correlation(forecast: np.ndarray, observed: np.ndarray) -> float:
    if np.std(forecast) == 0 or np.std(observed) == 0:
        return 0.0
    return float(np.corrcoef(forecast, observed)[0, 1])


# ---- Contingency table ----

def contingency_table(
    forecast: np.ndarray, observed: np.ndarray, threshold: float
) -> tuple[int, int, int, int]:
    """Returns (Hits, False Alarms, Misses, Correct Negatives)."""
    H = int(((forecast >= threshold) & (observed >= threshold)).sum())
    F = int(((forecast >= threshold) & (observed < threshold)).sum())
    M = int(((forecast < threshold) & (observed >= threshold)).sum())
    CN = int(((forecast < threshold) & (observed < threshold)).sum())
    return H, F, M, CN


# ---- Categorical scores ----

def pod(H: int, M: int) -> float:
    """Probability of Detection."""
    return H / max(H + M, 1)


def far(H: int, F: int) -> float:
    """False Alarm Ratio."""
    return F / max(H + F, 1)


def csi(H: int, M: int, F: int) -> float:
    """Critical Success Index (Threat Score)."""
    return H / max(H + M + F, 1)


def ets(H: int, M: int, F: int, CN: int) -> float:
    """Equitable Threat Score (Gilbert Skill Score)."""
    N = H + M + F + CN
    H_random = (H + M) * (H + F) / max(N, 1)
    return (H - H_random) / max(H + M + F - H_random, 1e-10)


# ---- Spatial verification ----

def compute_fss(
    forecast_grid: np.ndarray,
    observed_grid: np.ndarray,
    threshold: float,
    neighborhood: int,
) -> float:
    """Fractions Skill Score at a given neighborhood scale.

    FSS = 1 - FBS / FBS_worst
    """
    fcst_binary = (forecast_grid >= threshold).astype(float)
    obs_binary = (observed_grid >= threshold).astype(float)
    frac_fcst = uniform_filter(fcst_binary, size=neighborhood)
    frac_obs = uniform_filter(obs_binary, size=neighborhood)
    fbs = np.mean((frac_fcst - frac_obs) ** 2)
    fbs_worst = np.mean(frac_fcst ** 2) + np.mean(frac_obs ** 2)
    return float(1 - fbs / max(fbs_worst, 1e-10))


# ---- Full verification report ----

def run_verification(
    raw: np.ndarray,
    corrected: np.ndarray,
    observed: np.ndarray,
    thresholds: tuple[float, ...] = (15.5, 64.5, 115.5),
) -> dict:
    """Full verification report: raw vs. corrected across all metrics.

    Returns nested dict with 'continuous' and 'categorical' sections.
    """
    report = {
        "continuous": {
            "raw": {
                "rmse": rmse(raw, observed),
                "mae": mae(raw, observed),
                "bias": bias(raw, observed),
                "r": correlation(raw, observed),
            },
            "corrected": {
                "rmse": rmse(corrected, observed),
                "mae": mae(corrected, observed),
                "bias": bias(corrected, observed),
                "r": correlation(corrected, observed),
            },
        },
        "categorical": {},
    }

    for tau in thresholds:
        H_r, F_r, M_r, CN_r = contingency_table(raw, observed, tau)
        H_c, F_c, M_c, CN_c = contingency_table(corrected, observed, tau)
        report["categorical"][str(tau)] = {
            "raw": {
                "pod": pod(H_r, M_r),
                "far": far(H_r, F_r),
                "csi": csi(H_r, M_r, F_r),
                "ets": ets(H_r, M_r, F_r, CN_r),
            },
            "corrected": {
                "pod": pod(H_c, M_c),
                "far": far(H_c, F_c),
                "csi": csi(H_c, M_c, F_c),
                "ets": ets(H_c, M_c, F_c, CN_c),
            },
        }

    return report
