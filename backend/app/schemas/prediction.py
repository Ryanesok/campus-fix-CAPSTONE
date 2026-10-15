from enum import Enum

from pydantic import BaseModel


class FacilityCategory(str, Enum):
    AC = "AC"
    KURSI = "KURSI"
    LAMPU = "LAMPU"
    PROYEKTOR = "PROYEKTOR"


class Prediction(BaseModel):
    category: FacilityCategory
    confidence: float | None = None


class PredictionResponse(BaseModel):
    success: bool = True
    prediction: Prediction
