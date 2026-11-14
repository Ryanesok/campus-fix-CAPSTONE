"""CampusFix AI Module.

Terpisah dari frontend dan backend untuk mendukung modularitas sistem.
"""
from ai.predictor import FacilityPredictor, get_facility_predictor, predict_facility

__all__ = ["FacilityPredictor", "get_facility_predictor", "predict_facility"]
