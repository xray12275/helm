"""
Pydantic models for vision service API
"""

from typing import Optional, List
from pydantic import BaseModel


class BoundingBox(BaseModel):
    """Bounding box coordinates and confidence"""
    x: float
    y: float
    width: float
    height: float
    confidence: float


class DetectedUnit(BaseModel):
    """A unit detected in an image"""
    bbox: BoundingBox
    class_label: str
    embedding: Optional[List[float]] = None


class UnitIdentification(BaseModel):
    """Result of identifying a unit against roster"""
    unit_id: str
    label: str
    confidence: float
    position: dict


class CalibrationResult(BaseModel):
    """Result of table calibration"""
    homography_matrix: List[List[float]]
    pixels_per_inch: float
    table_bounds: dict


class TerrainFootprint(BaseModel):
    """A terrain piece detected in an image"""
    id: str
    type: str
    polygon: List[dict]
    blocks_los: bool
    provides_cover: bool


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    models_loaded: List[str]
