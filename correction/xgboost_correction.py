"""Regime-conditioned XGBoost bias correction (Section 5.2).
One XGBoost regressor per regime, probability-weighted blending.
"""

import logging
import os

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb

from shared.config import REGIME_CLASSES, MODELS_DIR

logger = logging.getLogger(__name__)


class RegimeConditionedCorrector:
    """Per-regime XGBoost correction with probability-weighted blending.

    For each regime k, trains a regressor to predict the residual:
        residual_k = P_observed - P_raw

    At inference, blends corrections using regime probabilities:
        P_corrected = sum_k P(regime=k) * (P_raw + residual_hat_k)
    """

    def __init__(self, model_path: str = os.path.join(MODELS_DIR, "correction_models.pkl")):
        self.model_path = model_path
        self.models: dict[str, xgb.XGBRegressor] = {}

    def train(self, X_by_regime: dict[str, pd.DataFrame], y_by_regime: dict[str, np.ndarray]):
        """Train one correction model per regime.

        Args:
            X_by_regime: {regime_name: feature DataFrame}
            y_by_regime: {regime_name: residual array (P_obs - P_raw)}
        """
        for regime in REGIME_CLASSES:
            if regime not in X_by_regime or len(X_by_regime[regime]) < 20:
                logger.warning(f"Skipping regime '{regime}': insufficient data")
                continue

            X = X_by_regime[regime]
            y = y_by_regime[regime]

            # Heavy-rain upweighting: 3x weight for obs > 64.5mm (IMD heavy threshold)
            weights = np.ones(len(y))
            if "raw_nwp_precip" in X.columns:
                obs_approx = X["raw_nwp_precip"].values + y
                heavy_mask = obs_approx > 64.5
                weights[heavy_mask] = 3.0

            model = xgb.XGBRegressor(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.1,
                objective="reg:squarederror",
            )
            model.fit(X, y, sample_weight=weights)
            self.models[regime] = model
            logger.info(f"Trained correction model for regime '{regime}' on {len(X)} samples")

        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.models, self.model_path)
        logger.info(f"Saved correction models to {self.model_path}")

    def load(self):
        """Load pre-trained models from disk."""
        self.models = joblib.load(self.model_path)
        logger.info(f"Loaded {len(self.models)} correction models")

    def correct(
        self,
        raw_forecast: np.ndarray,
        regime_probs: dict[str, float],
        covariates: pd.DataFrame,
    ) -> np.ndarray:
        """Apply probability-weighted regime correction.

        P_corrected = sum_k P(regime=k) * (P_raw + residual_hat_k)

        Args:
            raw_forecast: Raw NWP precipitation values.
            regime_probs: {regime_name: probability} from classifier.
            covariates: Feature DataFrame matching training schema.

        Returns:
            Corrected precipitation (clipped >= 0).
        """
        corrected = np.zeros_like(raw_forecast, dtype=float)

        for regime, prob in regime_probs.items():
            if regime in self.models and prob > 0.01:
                residual = self.models[regime].predict(covariates)
                corrected += prob * (raw_forecast + residual)

        return np.clip(corrected, 0, None)
