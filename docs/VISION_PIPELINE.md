# Helm: Vision Pipeline

## Overview

Helm's vision system enables markerless recognition of Warhammer 40K units on a tabletop. The pipeline spans from on-device capture (iPhone) through cloud-based inference to real-time tracking and terrain mapping. Key features: ≤5s fingerprint scans per unit pre-game, A/B/C auto-labeling for duplicates, confidence scoring, and terrain footprint extraction via LiDAR and edge detection.

---

## End-to-End Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 0: PRE-GAME FINGERPRINTING (~5s per unit, once per match)    │
└────────────────────┬────────────────────────────────────────────────┘
                     │
      ┌──────────────┴──────────────┐
      │                             │
      ▼                             ▼
┌──────────────────┐        ┌──────────────────────┐
│ iPhone Camera    │        │ User Places Unit     │
│ Capture 4 angles│        │ on 12"×12" white mat │
│ (0°, 90°,180°,  │        │ TensorFlow Lite      │
│ 270°) in ≤5s    │        │ embeds on-device     │
└──────┬───────────┘        └──────────┬───────────┘
       │                              │
       └──────────────┬───────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ Upload frames to       │
         │ cloud + embeddings     │
         └────────┬───────────────┘
                  │
                  ▼
   ┌──────────────────────────────┐
   │ Cloud: Match roster + frames  │
   │ - Classify unit type         │
   │   (Intercessors? Guardsmen?) │
   │ - Detect duplicates (A/B/C)  │
   │ - Store fingerprint (embed)  │
   │   in database                │
   └──────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: LIVE TRACKING (~50ms per frame, continuous during match)  │
└────────────────────┬────────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
        ▼                         ▼
┌──────────────────┐      ┌──────────────────┐
│ iPhone Camera:   │      │ On-Device        │
│ Continuous feed  │      │ TensorFlow Lite  │
│ 30 fps           │      │ per-frame embed  │
└──────┬───────────┘      └────────┬─────────┘
       │                          │
       │      ┌──────────────────┘
       │      │
       ▼      ▼
    Frame → Embedding (128-D)
       │
       ├─→ Compare to fingerprints (cosine similarity)
       │   - Top-K matches (k=3)
       │   - Score: sim(embed_frame, embed_fingerprint)
       │   - Confidence = max(scores)
       │
       └─→ Track temporal coherence (DeepSORT/ByteTrack)
           - Frame t-1: Guardsmen at (22, 16)
           - Frame t: Guardsmen at (22.5, 16.2)
           - Frame t+1: Guardsmen at (23, 16.5)
           - → Continuous identity assignment

       ▼
    Real-time position + confidence
       │
       └─→ WebSocket broadcast to all clients
           (state update every 200ms or on significant move)
```

---

## Detailed Pipeline Steps

### Step 1: Base Detection

**Goal:** Locate unit bases in video frame (before extraction/embedding).

**Methods:**

#### Hough Circle Detection (Fast, on-device)
```python
import cv2

def detect_bases_hough(frame):
    """Detect circular bases (25mm, 32mm, 40mm, 50mm in standard)."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Hough circle detection
    circles = cv2.HoughCircles(
        gray,
        cv2.HOUGH_GRADIENT,
        dp=1,
        minDist=20,  # Minimum distance between circle centers
        param1=50,   # Canny edge threshold
        param2=30,   # Circle center threshold
        minRadius=15,  # ~10mm (0.39 inches)
        maxRadius=100  # ~60mm (2.4 inches)
    )

    bases = []
    if circles is not None:
        circles = np.uint16(np.around(circles))
        for (x, y, r) in circles[0]:
            bases.append({
                'center': (x, y),
                'radius': r,
                'confidence': 0.8  # From circle detection quality
            })

    return bases
```

#### YOLO-v8 (More robust, ~100ms on iPhone)
```
Alternative: Use lightweight YOLO detector trained on
Warhammer 40K unit images (bases in various lighting conditions).
- Input: full frame
- Output: bounding boxes around unit bases
- Latency: ~100ms on iPhone 12+
- Confidence: ≥ 80% on trained dataset
```

#### Fallback: Edge Detection
```python
def detect_bases_edges(frame):
    """Fallback: detect circular edges."""
    edges = cv2.Canny(frame, 100, 200)
    contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    bases = []
    for contour in contours:
        (x, y), radius = cv2.minEnclosingCircle(contour)
        if 15 < radius < 100:  # Valid base size
            bases.append({'center': (x, y), 'radius': radius})

    return bases
```

**Output:** List of detected base regions (x, y, radius, confidence)

---

### Step 2: Unit Crop & Preprocessing

**Goal:** Extract a standardized image patch around each detected base for embedding.

```python
def crop_unit_image(frame, base, size=224):
    """
    Extract a 224×224 image patch centered on base.
    224×224 is standard MobileNet-v3 input.
    """
    (cx, cy), radius = base['center'], base['radius']

    # Define crop region
    x_start = max(0, int(cx - size // 2))
    y_start = max(0, int(cy - size // 2))
    x_end = min(frame.shape[1], x_start + size)
    y_end = min(frame.shape[0], y_start + size)

    crop = frame[y_start:y_end, x_start:x_end]

    # Resize to 224×224 (preserve aspect ratio with padding)
    crop = cv2.resize(crop, (224, 224))

    # Normalize (ImageNet stats)
    crop = crop.astype(np.float32) / 255.0
    crop -= [0.485, 0.456, 0.406]  # RGB mean
    crop /= [0.229, 0.224, 0.225]  # RGB std

    return crop
```

---

### Step 3: Embedding Extraction (On-Device MobileNet-v3)

**Goal:** Convert image patch to a 128-dimensional embedding vector (unit fingerprint).

**Model:** MobileNet-v3-Small (2.5 MB TF Lite)
- Input: 224×224 RGB image
- Output: 1280-D feature vector (pool after last layer)
- Latency: ~50ms per image on iPhone 12+
- Quantized (int8): reduced latency + memory footprint

```python
import tensorflow as tf

class UnitEmbedder:
    def __init__(self, model_path='mobilenet_v3_small.tflite'):
        self.interpreter = tf.lite.Interpreter(model_path)
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()

    def embed(self, image_patch):
        """
        image_patch: 224×224 normalized float array
        Returns: 128-D embedding (PCA-reduced from 1280-D)
        """
        # Set input
        self.interpreter.set_tensor(
            self.input_details[0]['index'],
            np.expand_dims(image_patch, 0).astype(np.float32)
        )

        # Invoke inference
        self.interpreter.invoke()

        # Get output (1280-D feature)
        output = self.interpreter.get_tensor(self.output_details[0]['index'])
        features = output[0]  # Shape: (1280,)

        # PCA reduction to 128-D (pre-computed PCA matrix on device)
        embedding = self.pca_reduce(features)  # Shape: (128,)

        # L2 normalize
        embedding = embedding / (np.linalg.norm(embedding) + 1e-8)

        return embedding

    def pca_reduce(self, features):
        """Reduce 1280-D to 128-D using pre-trained PCA."""
        # pca_matrix: shape (128, 1280), loaded from file
        return np.dot(self.pca_matrix, features)
```

**On-device processing:**
- Per-frame latency: ~50ms
- Inference runs continuously; frames processed in pipeline
- Embeddings buffered in memory; sent to cloud in batches

---

### Step 4: Fingerprint Matching (Cloud)

**Goal:** Match embeddings from live frames to pre-match fingerprints; identify unit + label.

**Pre-Game Fingerprint Storage:**
```json
{
  "unitId": "u456",
  "matchId": "m123",
  "datasheet": "Intercessors",
  "label": "A",  // auto-labeled by system
  "embeddings": [
    [0.123, 0.456, ..., 0.789],  // angle 0°
    [0.124, 0.450, ..., 0.788],  // angle 90°
    [0.122, 0.457, ..., 0.790],  // angle 180°
    [0.123, 0.458, ..., 0.788]   // angle 270°
  ],
  "averageEmbedding": [0.123, 0.455, ..., 0.789],
  "capturedAt": "2025-02-15T14:00:00Z",
  "confidence": 0.92
}
```

**Matching Algorithm:**
```python
def match_embedding_to_fingerprints(embedding, fingerprints, roster):
    """
    embedding: 128-D live frame embedding
    fingerprints: dict of pre-scanned units
    roster: list of expected units in army

    Returns: { unitId, label, confidence, alternativeMatches }
    """
    scores = []

    for unit_id, fingerprint in fingerprints.items():
        # Cosine similarity: embedding · avg_fingerprint
        avg_embed = np.array(fingerprint['averageEmbedding'])
        similarity = np.dot(embedding, avg_embed)  # ~[-1, 1]

        # Normalize to [0, 1]
        score = (similarity + 1) / 2
        scores.append({
            'unitId': unit_id,
            'label': fingerprint['label'],
            'score': score,
            'datasheet': fingerprint['datasheet']
        })

    # Sort by descending score
    scores = sorted(scores, key=lambda x: x['score'], reverse=True)

    # Roster-constrained: unit must exist in roster
    valid_scores = [s for s in scores if s['unitId'] in roster['unitIds']]

    if not valid_scores:
        return { 'confidence': 0, 'unitId': None }

    top_match = valid_scores[0]
    confidence = top_match['score']

    return {
        'unitId': top_match['unitId'],
        'label': top_match['label'],
        'confidence': confidence,
        'alternativeMatches': valid_scores[1:3]  # Top 3 candidates
    }
```

**Confidence Thresholds:**
- ≥ 0.85: Auto-confirm unit (no manual verification)
- 0.70–0.85: Prompt confirmation ("I'm 75% sure this is Intercessors A. Confirm?")
- < 0.70: Force manual selection from roster

---

### Step 5: Temporal Tracking (DeepSORT / ByteTrack)

**Goal:** Maintain unit identity across frames (position trajectory, occlusion handling).

**Algorithm: ByteTrack** (simpler, efficient; alternatives: DeepSORT, Kalman filter)

```python
class ByteTracker:
    def __init__(self, match_id):
        self.match_id = match_id
        self.tracks = {}  # { track_id: Track object }
        self.next_track_id = 0

    def update(self, frame_detections):
        """
        frame_detections: list of {
            unitId, embedding, position (x, y), confidence
        }

        Returns: {
            track_id, unitId, position, confidence
        }
        """
        # Match detections to existing tracks
        matches, unmatched_dets, unmatched_trks = \
            self.associate_detections_to_tracks(frame_detections)

        # Update matched tracks
        for det_idx, trk_idx in matches:
            det = frame_detections[det_idx]
            track = self.tracks[trk_idx]
            track.position = det['position']
            track.embedding = det['embedding']
            track.age += 1
            track.confidence = det['confidence']

        # Create new tracks for unmatched detections
        for det_idx in unmatched_dets:
            det = frame_detections[det_idx]
            track = Track(
                id=self.next_track_id,
                unit_id=det['unitId'],
                position=det['position'],
                embedding=det['embedding'],
                age=1,
                confidence=det['confidence']
            )
            self.tracks[self.next_track_id] = track
            self.next_track_id += 1

        # Remove dead tracks (no matches for N frames)
        self.tracks = {
            k: v for k, v in self.tracks.items()
            if v.age < 10  # Max 10 frames without detection
        }

        return self.tracks

    def associate_detections_to_tracks(self, detections):
        """
        Hungarian algorithm: match detections to tracks
        using IoU (bounding box overlap) + embedding similarity.
        """
        # Build cost matrix
        cost_matrix = np.zeros((len(detections), len(self.tracks)))

        for d_idx, det in enumerate(detections):
            for t_idx, (_, track) in enumerate(self.tracks.items()):
                # IoU cost (position)
                iou = self.compute_iou(det['position'], track.position)

                # Embedding similarity cost
                embed_sim = np.dot(det['embedding'], track.embedding)

                # Combined cost (lower is better match)
                cost = (1 - iou) * 0.5 + (1 - embed_sim) * 0.5
                cost_matrix[d_idx, t_idx] = cost

        # Hungarian matching
        from scipy.optimize import linear_sum_assignment
        row_ind, col_ind = linear_sum_assignment(cost_matrix)

        matches = list(zip(row_ind, col_ind))
        unmatched_dets = [i for i in range(len(detections)) if i not in row_ind]
        unmatched_trks = [i for i in range(len(self.tracks)) if i not in col_ind]

        return matches, unmatched_dets, unmatched_trks
```

**Output:** Continuous track IDs with positions; updates broadcast every ~200ms to WebSocket clients.

---

### Step 6: Roster-Constrained Identification

**Goal:** Ensure identified unit exists in player's roster; handle A/B/C labeling.

**Pre-match Setup:**
```json
{
  "matchId": "m123",
  "player1": {
    "armyId": "army-001",
    "units": [
      {
        "unitId": "u456",
        "datasheet": "Intercessors",
        "models": 5,
        "expectedCount": 1
      },
      {
        "unitId": "u789",
        "datasheet": "Intercessors",
        "models": 10,
        "expectedCount": 1  // Second Intercessor squad
      },
      { "unitId": "u999", "datasheet": "Guardsmen", "models": 20, "expectedCount": 1 }
    ]
  }
}
```

**Duplicate Detection & A/B/C Labeling:**
```python
def label_duplicate_units(roster):
    """
    Scan roster for duplicate datasheets.
    Auto-assign A/B/C labels.
    """
    datasheet_counts = {}

    for unit in roster['units']:
        datasheet = unit['datasheet']
        if datasheet not in datasheet_counts:
            datasheet_counts[datasheet] = []
        datasheet_counts[datasheet].append(unit['unitId'])

    labels = {}
    label_letters = 'ABCDEFGH'

    for datasheet, unit_ids in datasheet_counts.items():
        if len(unit_ids) > 1:
            # Duplicates: assign A, B, C, etc.
            for idx, unit_id in enumerate(unit_ids):
                labels[unit_id] = label_letters[idx]
        else:
            # Unique: no label
            labels[unit_ids[0]] = None

    return labels
```

**During Live Tracking:**
- When Intercessors detected, check roster: 2 units with datasheet "Intercessors"
- First detection: assign to "Intercessors A"
- Second detection: assign to "Intercessors B"
- Tracking persists labels (once assigned, unit retains label across frames)

---

### Step 7: Homography & Position Mapping

**Goal:** Convert pixel coordinates (from camera frame) to table coordinates (inches).

**Pre-Match Calibration:**
```python
def calibrate_table_homography(calibration_images):
    """
    User provides images of table with known references:
    - 12-inch ruler (horizontal and vertical)
    - Center crosshairs (chalk marks)

    Returns: 3×3 homography matrix H s.t.
    table_coords = H @ pixel_coords
    """

    # Manual annotation: player marks ruler endpoints + crosshairs in images
    # Image 1: horizontal ruler from (100, 200) to (500, 200) = 12 inches
    # Image 2: vertical ruler from (300, 100) to (300, 400) = 12 inches
    # Image 3: center (400, 300)

    # Collect point correspondences
    src_points = np.array([
        [100, 200],  # Pixel
        [500, 200],  # Pixel
        [300, 100],  # Pixel
        [300, 400],  # Pixel
        [400, 300],  # Pixel (center)
    ], dtype=np.float32)

    dst_points = np.array([
        [0, 0],       # Table coord (0", 0")
        [12, 0],      # Table coord (12", 0")
        [0, 12],      # Table coord (0", 12")
        [0, -12],     # Table coord (0", -12")
        [24, 24],     # Table coord (24", 24") [center of 48"×48" table]
    ], dtype=np.float32)

    # Compute homography using OpenCV
    H, _ = cv2.findHomography(src_points, dst_points)

    return H


def pixel_to_table_coords(pixel_pos, H):
    """
    Convert pixel coordinates to table coordinates.

    pixel_pos: (x_pixel, y_pixel)
    Returns: (x_inches, y_inches)
    """
    px = np.array([pixel_pos[0], pixel_pos[1], 1.0])
    table_homog = H @ px
    table_coords = table_homog[:2] / table_homog[2]
    return tuple(table_coords)
```

**Error Mitigation:**
- RMSE (root mean square error) from homography fit tells calibration quality
- If RMSE > 1 inch: prompt user to re-calibrate
- If RMSE < 0.2 inches: high confidence in position estimates

---

### Step 8: Terrain Scanning

**Goal:** Map terrain features (ruins, hills, woods) to 2D footprints for LoS and cover checks.

#### Method A: LiDAR (iPhone 12+)

```python
import ARKit

def scan_terrain_with_lidar():
    """
    iPhone 12+ has integrated LiDAR scanner.
    Captures 3D point cloud of table.
    """
    ar_frame = ARFrame()
    lidar_depth = ar_frame.rawFeaturePoints  # (x, y, z) in ARKit coords

    # Cluster points by vertical level (height)
    terrain_features = []

    for feature in lidar_depth:
        if feature.z > 0.5:  # 0.5 inches above table
            # This is terrain (ruin, hill, etc.)
            terrain_features.append({
                'x': feature.x,
                'y': feature.y,
                'height': feature.z,
                'confidence': 0.9
            })

    # Cluster into regions (DBscan)
    from sklearn.cluster import DBSCAN

    clustering = DBSCAN(eps=2, min_samples=5).fit(
        [(f['x'], f['y']) for f in terrain_features]
    )

    terrain_map = []
    for cluster_id in set(clustering.labels_):
        cluster_points = [
            terrain_features[i]
            for i in range(len(terrain_features))
            if clustering.labels_[i] == cluster_id
        ]

        # Compute footprint (convex hull)
        points_2d = np.array([(p['x'], p['y']) for p in cluster_points])
        hull = ConvexHull(points_2d)

        terrain_map.append({
            'id': f'terrain_{cluster_id}',
            'type': 'unknown',  # User labels: ruin, hill, woods, etc.
            'footprint': hull.points.tolist(),
            'height': np.mean([p['z'] for p in cluster_points]),
            'confidence': 0.9
        })

    return terrain_map
```

#### Method B: Edge Detection (Fallback for older iPhones)

```python
def scan_terrain_with_edges(frame, homography):
    """
    Fallback: detect terrain by edge detection + shadow/color analysis.
    """
    edges = cv2.Canny(frame, 100, 200)

    # Dilate to close small gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    edges = cv2.dilate(edges, kernel, iterations=2)

    # Find contours
    contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    terrain_map = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if area > 100:  # Ignore small noise
            # Approximate contour as polygon
            epsilon = 0.02 * cv2.arcLength(contour, True)
            poly = cv2.approxPolyDP(contour, epsilon, True)

            # Convert to table coordinates
            table_coords = []
            for point in poly:
                px = point[0]
                table_pos = pixel_to_table_coords(px, homography)
                table_coords.append(table_pos)

            terrain_map.append({
                'id': f'terrain_{len(terrain_map)}',
                'type': 'unknown',  # User labels
                'footprint': table_coords,
                'confidence': 0.7  # Lower confidence than LiDAR
            })

    return terrain_map
```

**Output:** List of terrain features with footprints; used for LoS checks (rules-engine queries).

---

## Pre-Game Fingerprint Scanning Flow

**Duration:** ≤5 seconds per unit

```
1. [0.0s] User places unit on 12"×12" white mat
2. [0.0s] iPhone app starts fingerprinting UI
3. [1.0s] User rotates unit to first angle (0°)
         → Camera captures frame → TF Lite embeds on-device
4. [1.5s] User rotates to second angle (90°)
         → Frame + embedding captured
5. [2.5s] User rotates to third angle (180°)
         → Frame + embedding captured
6. [3.5s] User rotates to fourth angle (270°)
         → Frame + embedding captured
7. [4.0s] iPhone app computes average embedding
         → Uploads frames + embeddings to cloud
8. [4.5s] Cloud classifies unit (datasheet) via MobileNet
         → Detects duplication (A/B/C label)
         → Stores fingerprint
9. [5.0s] ARKit preview shows: "✓ Scanned Intercessors A"
         User taps "Next Unit" to continue scanning

Total for 12 units: ~60 seconds (includes setup time)
```

---

## Real-Time Tracking Accuracy

**Target Metrics:**
- Position accuracy: ±0.5 inches (table homography calibration error)
- Frame latency: ≤ 200ms (board update frequency)
- Unit identification confidence: ≥ 95% (high-quality fingerprints)
- Terrain mapping: ≥ 90% coverage (LiDAR scan)

**Handling Low Confidence:**
```
Frame t: Embedding similarity = 0.65 (65% confidence)
  → Display yellow ? icon in AR
  → Log: "Low confidence unit detection"
  → Prompt user: "Is this Intercessors A? Tap ✓ or ✗"

Frame t+1: User taps ✓
  → Event: ManualConfirmation { unitId, confidence: 0.65 }
  → Unit position locked; resume normal tracking

Frame t+1: User taps ✗
  → Prompt: "Which unit is it?"
  → User selects from roster list (dropdown)
  → Event: ManualCorrection { unitId: "new_id" }
```

---

## Performance Optimization

### On-Device (iPhone)
- TensorFlow Lite quantized model (int8): 4 MB, ~50ms inference
- Process only N keyframes per second (not all 30 fps): save battery
- Batch embedding uploads (accumulate 30 frames, then send)

### Cloud
- Redis caching for homography matrices (don't recompute per frame)
- Async processing: vision inference on GPU batch, then update materialized view
- Stream tracking updates via WebSocket (no polling)

---

## Training Data & Provenance Tracking

**On-Device Model (MobileNet-v3):**
- Training dataset: ~10k Warhammer 40K unit photos (crowdsourced)
- Augmentation: rotation, brightness, scale, occlusion
- Fine-tuned on 40K datasheet images for better feature extraction
- Versioning: model_v1.0, model_v1.1, etc. (stored in app bundle)

**Provenance Tracking:**
```json
{
  "modelId": "mobilenet_v3_40k_v1.1",
  "trainingDataset": {
    "source": "community_crowdsourced",
    "samples": 10234,
    "lastUpdated": "2025-01-15",
    "license": "CC-BY-SA"
  },
  "deployedAt": "2025-02-01",
  "updateHistory": [
    { "version": "v1.0", "date": "2024-12-15", "improvement": "baseline" },
    { "version": "v1.1", "date": "2025-01-15", "improvement": "better lighting invariance" }
  ]
}
```

---

## References

- [ARCHITECTURE.md](ARCHITECTURE.md) — Vision Service, on-device TensorFlow Lite
- [DATA_MODEL.md](DATA_MODEL.md) — Unit, Terrain, Event schemas
- [RULES_ENGINE.md](RULES_ENGINE.md) — LoS and cover checks using terrain footprints
