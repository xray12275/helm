"""
Vision service for detecting and identifying units in Warhammer 40K table images
"""

import base64
import io
import logging
from typing import Optional, List

import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
import uvicorn

from .models import (
    DetectedUnit,
    UnitIdentification,
    CalibrationResult,
    TerrainFootprint,
    HealthResponse,
    BoundingBox
)
from .pipeline import (
    BaseDetector,
    UnitClassifier,
    RosterMatcher,
    TableCalibrator,
    TerrainScanner,
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Helm Vision Service",
    description="Computer vision API for Warhammer 40K unit detection and identification",
    version="1.0.0"
)

# Initialize vision pipeline components
detector = BaseDetector()
classifier = UnitClassifier()
roster_matcher = RosterMatcher()
calibrator = TableCalibrator()
terrain_scanner = TerrainScanner()

# ============= UTILITY FUNCTIONS =============

def load_image(image_data: bytes) -> np.ndarray:
    """Load image from bytes and convert to numpy array"""
    image = Image.open(io.BytesIO(image_data))
    if image.mode == 'RGBA':
        image = image.convert('RGB')
    return np.array(image)


def base64_to_image(base64_str: str) -> np.ndarray:
    """Convert base64 string to numpy array"""
    image_data = base64.b64decode(base64_str)
    return load_image(image_data)


# ============= ENDPOINTS =============

@app.post("/api/detect", response_model=List[DetectedUnit])
async def detect_units(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = None
) -> List[DetectedUnit]:
    """
    Detect units (mini bases) in an image.

    Accepts either:
    - Multipart file upload
    - Base64-encoded image in request body

    Returns list of detected units with bounding boxes and confidence scores.
    """
    try:
        if file:
            image_data = await file.read()
            image = load_image(image_data)
        elif image_base64:
            image = base64_to_image(image_base64)
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide either file or image_base64"
            )

        # Run detector
        detections = detector.detect(image)

        # Optionally generate embeddings
        for detection in detections:
            # Extract crop region
            x, y = int(detection.bbox.x), int(detection.bbox.y)
            w, h = int(detection.bbox.width), int(detection.bbox.height)
            crop = image[y:y+h, x:x+w]

            if crop.size > 0:
                # Generate embedding
                detection.embedding = classifier.embed(crop)

        logger.info(f"Detected {len(detections)} units")
        return detections

    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/fingerprint", response_model=List[float])
async def fingerprint_unit(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = None
) -> List[float]:
    """
    Generate an embedding fingerprint for a unit from multiple angles.

    Returns a 128-dimensional embedding vector that can be used for unit identification.
    """
    try:
        if file:
            image_data = await file.read()
            image = load_image(image_data)
        elif image_base64:
            image = base64_to_image(image_base64)
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide either file or image_base64"
            )

        # Generate embedding from the image
        embedding = classifier.embed(image)

        logger.info(f"Generated fingerprint with {len(embedding)} dimensions")
        return embedding

    except Exception as e:
        logger.error(f"Fingerprint error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/identify", response_model=List[UnitIdentification])
async def identify_units(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = None,
    roster_embeddings: Optional[dict] = None
) -> List[UnitIdentification]:
    """
    Identify units in an image by matching against roster embeddings.

    Process:
    1. Detect units in image
    2. Generate embeddings for each detected unit
    3. Match against roster embeddings
    4. Return identified units with confidence scores
    """
    try:
        if file:
            image_data = await file.read()
            image = load_image(image_data)
        elif image_base64:
            image = base64_to_image(image_base64)
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide either file or image_base64"
            )

        # Detect units
        detections = detector.detect(image)

        # Generate embeddings
        for detection in detections:
            x, y = int(detection.bbox.x), int(detection.bbox.y)
            w, h = int(detection.bbox.width), int(detection.bbox.height)
            crop = image[y:y+h, x:x+w]

            if crop.size > 0:
                detection.embedding = classifier.embed(crop)

        # Match to roster
        roster_embeddings = roster_embeddings or {}
        identifications = roster_matcher.match(detections, roster_embeddings)

        logger.info(f"Identified {len(identifications)} units")
        return identifications

    except Exception as e:
        logger.error(f"Identification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calibrate", response_model=CalibrationResult)
async def calibrate_table(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = None,
    reference_points: Optional[List[dict]] = None
) -> CalibrationResult:
    """
    Calibrate the table coordinate system from a calibration image.

    The calibration image should show:
    - The entire table
    - Known reference points (e.g., table corners, 12"x12" square)

    Returns homography matrix for transforming pixel coordinates to table inches.
    """
    try:
        if file:
            image_data = await file.read()
            image = load_image(image_data)
        elif image_base64:
            image = base64_to_image(image_base64)
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide either file or image_base64"
            )

        # Run calibration
        result = calibrator.calibrate(image, reference_points)

        logger.info(
            f"Calibration complete: {result.pixels_per_inch:.2f} ppi"
        )
        return result

    except Exception as e:
        logger.error(f"Calibration error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/terrain", response_model=List[TerrainFootprint])
async def scan_terrain(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = None
) -> List[TerrainFootprint]:
    """
    Detect terrain pieces in an overhead table image.

    Returns list of terrain footprints with:
    - Position and polygon coordinates
    - Terrain type (hill, forest, river, ruin, building)
    - LOS blocking and cover properties
    """
    try:
        if file:
            image_data = await file.read()
            image = load_image(image_data)
        elif image_base64:
            image = base64_to_image(image_base64)
        else:
            raise HTTPException(
                status_code=400,
                detail="Must provide either file or image_base64"
            )

        # Scan for terrain
        terrain = terrain_scanner.scan(image)

        logger.info(f"Detected {len(terrain)} terrain pieces")
        return terrain

    except Exception as e:
        logger.error(f"Terrain scan error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        service="vision-service",
        models_loaded=[
            "BaseDetector",
            "UnitClassifier",
            "RosterMatcher",
            "TableCalibrator",
            "TerrainScanner"
        ]
    )


# ============= STARTUP =============

if __name__ == "__main__":
    port = int(__import__('os').environ.get('PORT', 3003))
    print(f"""
╔═══════════════════════════════════════════════════════╗
║   Helm Warhammer 40K Referee - Vision Service         ║
╚═══════════════════════════════════════════════════════╝

🎥 Service:         http://localhost:{port}
📊 Docs:            http://localhost:{port}/docs
📋 Health:          http://localhost:{port}/api/health

Endpoints:
  POST   /api/detect        - Detect units
  POST   /api/fingerprint   - Generate unit embedding
  POST   /api/identify      - Identify units against roster
  POST   /api/calibrate     - Calibrate table coordinates
  POST   /api/terrain       - Detect terrain pieces
  GET    /api/health        - Health check

Vision Models:
  - BaseDetector (Hough circles → YOLO)
  - UnitClassifier (MobileNet embeddings)
  - RosterMatcher (cosine similarity)
  - TableCalibrator (homography transform)
  - TerrainScanner (edge detection → YOLO)

Press Ctrl+C to stop
    """)

    uvicorn.run(app, host="0.0.0.0", port=port)
