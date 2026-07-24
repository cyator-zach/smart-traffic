import os
import time
import dotenv
from flask import Flask, request, jsonify, render_template

# Load environment variables from .env first
dotenv.load_dotenv()

from config import UPLOAD_DIRS, YOLO_DIRS, LANE_NAMES, get_green_duration, get_density
from database import init_db, db_get_all_lanes, db_update_lane
from controller import traffic_controller
from yolo import run_yolo

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

@app.route("/")
def index():
    return render_template("dashboard.html")

@app.route("/api/firebase-config", methods=["GET"])
def firebase_config():
    """Endpoint to dynamically serve Firebase configurations to the client"""
    return jsonify({
        "apiKey": os.environ.get("FIREBASE_API_KEY", ""),
        "authDomain": os.environ.get("FIREBASE_AUTH_DOMAIN", ""),
        "projectId": os.environ.get("FIREBASE_PROJECT_ID", ""),
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", ""),
        "messagingSenderId": os.environ.get("FIREBASE_MESSAGING_SENDER_ID", ""),
        "appId": os.environ.get("FIREBASE_APP_ID", ""),
        "databaseURL": os.environ.get("FIREBASE_DATABASE_URL", "")
    })

@app.route("/upload/<lane>", methods=["POST"])
def upload_image(lane: str):
    lane = lane.lower()
    if lane not in ("a", "b", "c"):
        return jsonify({"error": "Jalur tidak valid. Gunakan a, b, atau c."}), 400

    if "image" not in request.files:
        return jsonify({"error": "Field 'image' tidak ditemukan dalam request."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Tidak ada file yang dipilih."}), 400

    allowed_ext = {".jpg", ".jpeg", ".png", ".bmp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_ext:
        return jsonify({"error": f"Format file tidak didukung: {ext}"}), 400

    save_path = os.path.join(UPLOAD_DIRS[lane], "latest.jpg")
    file.save(save_path)
    print(f"[INFO] Gambar jalur {lane.upper()} disimpan: {save_path}")

    try:
        counts = run_yolo(lane, save_path)
        total = sum(counts.values())
        density = get_density(total)
        green_dur = get_green_duration(total)

        db_update_lane(
            lane=lane,
            car=counts["car"],
            motorcycle=counts["motorcycle"],
            bus=counts["bus"],
            truck=counts["truck"],
            total=total,
            density=density,
            green_duration=green_dur,
        )

        print(f"[INFO] Jalur {lane.upper()} → Total={total}, Density={density}, Hijau={green_dur}s")

        return jsonify({
            "success": True,
            "lane": lane.upper(),
            "counts": counts,
            "total_vehicle": total,
            "density": density,
            "green_duration": green_dur,
            "yolo_image": f"/static/yolo/lane_{lane}/latest.jpg",
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Gagal memproses gambar: {str(e)}"}), 500

@app.route("/api/data", methods=["GET"])
def api_data():
    rows = db_get_all_lanes()
    ts = int(time.time())
    for row in rows:
        lane = row["lane"]
        row["upload_image"] = f"/static/uploads/lane_{lane}/latest.jpg?t={ts}"
        row["yolo_image"]   = f"/static/yolo/lane_{lane}/latest.jpg?t={ts}"
        row["lane_name"]    = LANE_NAMES.get(lane, lane.upper())
    return jsonify(rows)

@app.route("/api/seed", methods=["POST"])
def seed_dummy():
    dummy = [
        {"lane": "a", "car": 12, "motorcycle": 8, "bus": 3, "truck": 2},
        {"lane": "b", "car": 5,  "motorcycle": 3, "bus": 1, "truck": 1},
        {"lane": "c", "car": 20, "motorcycle": 15, "bus": 5, "truck": 5},
    ]
    for d in dummy:
        total = d["car"] + d["motorcycle"] + d["bus"] + d["truck"]
        density = get_density(total)
        green_dur = get_green_duration(total)
        db_update_lane(
            lane=d["lane"],
            car=d["car"],
            motorcycle=d["motorcycle"],
            bus=d["bus"],
            truck=d["truck"],
            total=total,
            density=density,
            green_duration=green_dur,
        )
    return jsonify({"success": True, "message": "Data dummy berhasil diisi."})

if __name__ == "__main__":
    for d in list(UPLOAD_DIRS.values()) + list(YOLO_DIRS.values()):
        os.makedirs(d, exist_ok=True)

    init_db()
    traffic_controller.start()

    print("=" * 55)
    print("  Smart Traffic Light Monitoring System")
    print("  http://127.0.0.1:5000")
    print("=" * 55)

    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
