"""Regime classifier inference service.
Thin wrapper around the trained model for use by the API and correction engine.
"""

import joblib
import pandas as pd

from shared.schemas import RegimeOutput
from shared.config import REGIME_CLASSES, MODELS_DIR


class RegimeClassifier:
    """Inference wrapper for the trained regime classifier."""

    def __init__(self, model_path: str = f"{MODELS_DIR}/regime_classifier.pkl"):
        self.model = joblib.load(model_path)

    def predict(self, index_window: pd.DataFrame) -> RegimeOutput:
        """Run regime classification on the latest day's features.

        Args:
            index_window: DataFrame with regime index features.
                          Uses the last row for prediction.

        Returns:
            RegimeOutput with regime name and probability breakdown.
        """
        latest = index_window.iloc[[-1]]
        probs = self.model.predict_proba(latest)[0]
        regime_idx = probs.argmax()

        return RegimeOutput(
            date=index_window.index[-1],
            regime=REGIME_CLASSES[regime_idx],
            probabilities=dict(zip(REGIME_CLASSES, probs.tolist())),
        )

    def predict_proba(self, features: pd.DataFrame) -> dict[str, float]:
        """Return just the probability dict (used by correction engine)."""
        probs = self.model.predict_proba(features.iloc[[-1]])[0]
        return dict(zip(REGIME_CLASSES, probs.tolist()))
