import os
import cv2
import threading
from ultralytics import YOLO
from config import MODEL_PATH, YOLO_DIRS, get_density

_model = None
_model_lock = threading.Lock()

def get_model() -> YOLO:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                print(f"[INFO] Loading YOLOv8n dari: {MODEL_PATH}")
                _model = YOLO(MODEL_PATH)
    return _model

def run_yolo(lane: str, image_path: str) -> dict:
    model = get_model()
    results = model(image_path, verbose=False)[0]

    img = cv2.imread(image_path)
    counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}

    for box in results.boxes:
        cls_id = int(box.cls[0])
        cls_name = results.names.get(cls_id, "")
        if cls_name not in counts:
            continue

        counts[cls_name] += 1

        x1, y1, x2, y2 = map(int, box.xyxy[0])
        conf = float(box.conf[0])

        color_map = {
            "car":        (0,   255, 0),
            "motorcycle": (255, 165, 0),
            "bus":        (0,   0,   255),
            "truck":      (128, 0,   128),
        }
        color = color_map.get(cls_name, (255, 255, 255))
        label = f"{cls_name} {conf:.2f}"

        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
        cv2.putText(img, label, (x1, max(y1 - 5, 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

    total = sum(counts.values())
    density = get_density(total)
    summary_lines = [
        f"Total: {total} ({density})",
        f"Car:{counts['car']} Moto:{counts['motorcycle']}",
        f"Bus:{counts['bus']} Truck:{counts['truck']}",
    ]
    y_offset = 25
    for line in summary_lines:
        cv2.putText(img, line, (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        y_offset += 22

    out_path = os.path.join(YOLO_DIRS[lane], "latest.jpg")
    cv2.imwrite(out_path, img)

    return counts
