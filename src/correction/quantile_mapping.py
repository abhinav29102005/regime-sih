"""Quantile Mapping baseline correction (Section 5.1).
Per-regime, per-location empirical CDF transfer.
"""

import numpy as np
from scipy.interpolate import interp1d


class QuantileMapper:
    """Empirical quantile mapping with zero-rain handling.

    For each regime k, grid cell g:
        Corrected = F_obs_inv(F_fcst(P_raw))

    Handles the zero-rainfall spike with a two-part model:
        1. P(rain > 0) modeled separately
        2. Given rain > 0, QM on the continuous positive distribution
    """

    def __init__(self, n_quantiles: int = 100):
        self.n_quantiles = n_quantiles
        self.quantiles = np.linspace(0, 1, n_quantiles + 1)
        self.raw_quantile_vals = None
        self.obs_quantile_vals = None
        self.transfer_func = None
        self.p_rain_raw = None
        self.p_rain_obs = None

    def fit(self, raw_forecast: np.ndarray, observed: np.ndarray):
        """Fit empirical CDFs from paired raw/observed data."""
        # Zero-rain probabilities
        self.p_rain_raw = (raw_forecast > 0).mean()
        self.p_rain_obs = (observed > 0).mean()

        # Fit CDFs on positive-rainfall values only
        raw_pos = raw_forecast[raw_forecast > 0]
        obs_pos = observed[observed > 0]

        if len(raw_pos) < 10 or len(obs_pos) < 10:
            # Not enough data — identity mapping
            self.transfer_func = lambda x: x
            return

        self.raw_quantile_vals = np.quantile(raw_pos, self.quantiles)
        self.obs_quantile_vals = np.quantile(obs_pos, self.quantiles)

        # Transfer function: F_obs_inv(F_raw(x))
        self.transfer_func = interp1d(
            self.raw_quantile_vals,
            self.obs_quantile_vals,
            bounds_error=False,
            fill_value=(self.obs_quantile_vals[0], self.obs_quantile_vals[-1]),
        )

    def correct(self, raw: np.ndarray) -> np.ndarray:
        """Apply quantile mapping correction."""
        corrected = np.where(
            raw > 0,
            self.transfer_func(raw),
            0.0,
        )
        return np.clip(corrected, 0, None)
