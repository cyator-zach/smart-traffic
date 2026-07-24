import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "traffic.db")
MODEL_PATH = os.path.join(BASE_DIR, "model", "yolov8n.pt")

UPLOAD_DIRS = {
    "a": os.path.join(BASE_DIR, "static", "uploads", "lane_a"),
    "b": os.path.join(BASE_DIR, "static", "uploads", "lane_b"),
    "c": os.path.join(BASE_DIR, "static", "uploads", "lane_c"),
}

YOLO_DIRS = {
    "a": os.path.join(BASE_DIR, "static", "yolo", "lane_a"),
    "b": os.path.join(BASE_DIR, "static", "yolo", "lane_b"),
    "c": os.path.join(BASE_DIR, "static", "yolo", "lane_c"),
}

LANE_NAMES = {"a": "Jalur A", "b": "Jalur B", "c": "Jalur C"}

VEHICLE_CLASSES = {"car": 2, "motorcycle": 3, "bus": 5, "truck": 7}

def get_green_duration(total: int) -> int:
    if total <= 5:
        return 10
    elif total <= 15:
        return 20
    elif total <= 30:
        return 30
    return 40

def get_density(total: int) -> str:
    if total <= 5:
        return "SEPI"
    elif total <= 15:
        return "NORMAL"
    return "PADAT"
