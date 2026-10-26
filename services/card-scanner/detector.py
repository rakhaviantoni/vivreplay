"""
Card boundary detection and perspective correction using OpenCV.
Implements Hough Line Transform with Contour approximation fallback,
matching the pipeline used by platforms like Cardtell.
"""

from typing import Tuple, Optional, Dict, Any
import numpy as np
import cv2


def order_points(pts: np.ndarray) -> np.ndarray:
    """
    Orders 4 points in consistent clockwise order:
    [top-left, top-right, bottom-right, bottom-left].
    """
    rect = np.zeros((4, 2), dtype="float32")
    # Top-left has smallest sum, bottom-right has largest sum
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]

    # Top-right has smallest diff (y - x), bottom-left has largest diff
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def four_point_transform(image: np.ndarray, pts: np.ndarray, target_w: int = 400, target_h: int = 560) -> np.ndarray:
    """
    Applies homography / perspective warp to straighten the card.
    Standard TCG aspect ratio is 2.5:3.5 (roughly 1:1.4).
    """
    rect = order_points(pts)
    dst = np.array([
        [0, 0],
        [target_w - 1, 0],
        [target_w - 1, target_h - 1],
        [0, target_h - 1]
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, matrix, (target_w, target_h), flags=cv2.INTER_LINEAR)
    return warped


def line_intersection(line1: Tuple[float, float, float, float], line2: Tuple[float, float, float, float]) -> Optional[Tuple[float, float]]:
    """Calculates intersection point between two line segments (x1, y1, x2, y2)."""
    x1, y1, x2, y2 = line1
    x3, y3, x4, y4 = line2

    denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if abs(denom) < 1e-5:
        return None  # Parallel

    px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom
    py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom
    return (px, py)


def detect_card_hough(gray: np.ndarray, edges: np.ndarray, min_area: float) -> Optional[np.ndarray]:
    """Attempts to find card boundary using HoughLinesP."""
    h, w = gray.shape
    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=70, minLineLength=int(min(h, w) * 0.25), maxLineGap=20)
    if lines is None or len(lines) < 4:
        return None

    horizontal = []
    vertical = []
    for line in lines:
        coords = np.squeeze(line)
        if coords.shape != (4,):
            continue
        x1, y1, x2, y2 = coords
        dx = abs(x2 - x1)
        dy = abs(y2 - y1)
        angle = np.degrees(np.arctan2(dy, dx))
        if angle < 30:
            horizontal.append((float(x1), float(y1), float(x2), float(y2)))
        elif angle > 60:
            vertical.append((float(x1), float(y1), float(x2), float(y2)))

    if len(horizontal) < 2 or len(vertical) < 2:
        return None

    # Sort horizontal by y-coordinate (top and bottom)
    horizontal.sort(key=lambda l: (l[1] + l[3]) / 2)
    top_line = horizontal[0]
    bottom_line = horizontal[-1]

    # Sort vertical by x-coordinate (left and right)
    vertical.sort(key=lambda l: (l[0] + l[2]) / 2)
    left_line = vertical[0]
    right_line = vertical[-1]

    tl = line_intersection(top_line, left_line)
    tr = line_intersection(top_line, right_line)
    br = line_intersection(bottom_line, right_line)
    bl = line_intersection(bottom_line, left_line)

    if not (tl and tr and br and bl):
        return None

    pts = np.array([tl, tr, br, bl], dtype="float32")
    # Verify bounds are within image with reasonable margin
    if np.any(pts < -w * 0.1) or np.any(pts[:, 0] > w * 1.1) or np.any(pts[:, 1] > h * 1.1):
        return None

    area = cv2.contourArea(pts.astype(np.int32))
    if area < min_area:
        return None

    # Validate aspect ratio matches standard card proportion (~1.4)
    rect = order_points(pts)
    w_box = float(np.linalg.norm(rect[0] - rect[1]))
    h_box = float(np.linalg.norm(rect[1] - rect[2]))
    if w_box <= 0 or h_box <= 0:
        return None
    aspect = max(w_box, h_box) / min(w_box, h_box)
    if aspect < 1.15 or aspect > 1.85:
        return None

    return pts


def detect_card_contour(edges: np.ndarray, min_area: float) -> Optional[np.ndarray]:
    """Fallback: finds the largest 4-sided convex polygon among external contours."""
    # Close small gaps in edges
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue

        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.025 * peri, True)

        if len(approx) == 4 and cv2.isContourConvex(approx):
            pts = approx.reshape(4, 2).astype("float32")
            rect = order_points(pts)
            w_box = float(np.linalg.norm(rect[0] - rect[1]))
            h_box = float(np.linalg.norm(rect[1] - rect[2]))
            if w_box > 0 and h_box > 0:
                aspect = max(w_box, h_box) / min(w_box, h_box)
                if 1.15 <= aspect <= 1.85:
                    return pts

    return None


def extract_card(image_bytes: bytes, target_w: int = 400, target_h: int = 560) -> Tuple[np.ndarray, Optional[np.ndarray], Dict[str, Any]]:
    """
    Takes raw image bytes, locates the card, straightens it,
    and returns (primary_image, secondary_image, metadata).

    If image is already cropped to the viewfinder (~1.15-1.70 aspect ratio):
      - primary: direct resize of the whole image (guarantees holo/mega-evolution/full-art cards stay intact)
      - secondary: perspective-warped card if 4 corners were detected
    If uncropped photo (e.g. card on table):
      - primary: perspective-warped card
      - secondary: center crop fallback
    """
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image bytes into OpenCV matrix")

    orig_h, orig_w = img.shape[:2]

    # Auto-orient: All TCG cards are portrait (height > width).
    # If the camera captured in landscape (w > h), rotate 90° clockwise to portrait.
    if orig_w > orig_h:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
        orig_h, orig_w = img.shape[:2]

    # Resize working image to max 1080px for fast edge detection
    max_dim = 1080
    scale = min(1.0, max_dim / max(orig_h, orig_w))
    if scale < 1.0:
        working = cv2.resize(img, (int(orig_w * scale), int(orig_h * scale)), interpolation=cv2.INTER_AREA)
    else:
        working = img.copy()

    work_h, work_w = working.shape[:2]
    min_area = (work_h * work_w) * 0.15  # Card must be at least 15% of frame

    # Preprocessing
    gray = cv2.cvtColor(working, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 40, 140)

    detection_source = "direct_resize"
    pts = None
    orig_aspect = orig_h / max(1, orig_w)
    is_already_cropped = 1.15 <= orig_aspect <= 1.70

    try:
        pts = detect_card_hough(gray, edges, min_area)
        if pts is not None:
            detection_source = "hough"
        else:
            pts = detect_card_contour(edges, min_area)
            if pts is not None:
                detection_source = "contour"

        # If image is already a card crop, reject tiny sub-contours that isolate inner art (e.g. Mega Diancie crystal box)
        if pts is not None:
            detected_area = cv2.contourArea(pts.astype(np.int32))
            frame_area = work_h * work_w
            if is_already_cropped and detected_area < frame_area * 0.35:
                pts = None
    except Exception as err:
        print(f"[Detector] OpenCV extraction warning: {err}")
        pts = None

    primary: np.ndarray
    secondary: Optional[np.ndarray] = None
    primary_source: str
    secondary_source: Optional[str] = None

    if is_already_cropped:
        # Viewfinder crop: direct resize is primary (perfect for Mega Diancie, holo, and full-art cards)
        primary = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_AREA)
        primary_source = "viewfinder_crop"
        if pts is not None:
            warped_pts = pts / scale if scale < 1.0 else pts
            secondary = four_point_transform(img, warped_pts, target_w, target_h)
            secondary_source = f"{detection_source}_deskew"
    else:
        # Gallery or raw photo with background: deskewed card is primary
        if pts is not None:
            warped_pts = pts / scale if scale < 1.0 else pts
            primary = four_point_transform(img, warped_pts, target_w, target_h)
            primary_source = detection_source
        else:
            # Fallback center crop
            aspect = 1.4
            if work_h / work_w > aspect:
                cw = work_w * 0.88
                ch = cw * aspect
            else:
                ch = work_h * 0.88
                cw = ch / aspect
            cx, cy = work_w / 2.0, work_h / 2.0
            pts_center = np.array([
                [cx - cw / 2, cy - ch / 2],
                [cx + cw / 2, cy - ch / 2],
                [cx + cw / 2, cy + ch / 2],
                [cx - cw / 2, cy + ch / 2]
            ], dtype="float32")
            if scale < 1.0:
                pts_center = pts_center / scale
            primary = four_point_transform(img, pts_center, target_w, target_h)
            primary_source = "center_crop"

    metadata = {
        "detection_source": primary_source,
        "secondary_source": secondary_source,
        "is_already_cropped": is_already_cropped,
        "original_width": orig_w,
        "original_height": orig_h,
        "scaled_working_width": work_w,
        "scaled_working_height": work_h,
        "corners": pts.tolist() if pts is not None else None
    }

    return primary, secondary, metadata
