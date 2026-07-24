import os
import json
import sqlite3
import urllib.request
import threading
import time
from config import DB_PATH

def firebase_sync_all():
    """
    Sync all traffic lanes data to Firebase Realtime Database via REST API.
    Runs in a background thread to prevent blocking sqlite operations or main thread.
    """
    def task():
        try:
            firebase_url = os.environ.get("FIREBASE_BACKEND_URL")
            if not firebase_url:
                # Silent skip if URL is not configured in .env
                return

            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM traffic_data ORDER BY lane").fetchall()
            conn.close()

            updates = {}
            for r in rows:
                lane = r["lane"]
                updates[f"lane_{lane}"] = {
                    "light_status":   (r["light_status"] or "RED").upper(),
                    "countdown":      r["countdown"] or 0,
                    "total_vehicle":  r["total_vehicle"] or 0,
                    "density":        r["density"] or "SEPI",
                    "green_duration": r["green_duration"] or 10,
                    "car":            r["car"] or 0,
                    "motorcycle":     r["motorcycle"] or 0,
                    "bus":            r["bus"] or 0,
                    "truck":          r["truck"] or 0,
                    "updated_at":     r["updated_at"] or ""
                }
            updates["last_sync"] = int(time.time() * 1000)
            
            url = f"{firebase_url.rstrip('/')}/traffic_lights.json"
            req_data = json.dumps(updates).encode("utf-8")
            req = urllib.request.Request(
                url, 
                data=req_data, 
                headers={"Content-Type": "application/json"}, 
                method="PATCH"
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                resp.read()
        except Exception:
            # Silent ignore to keep server running smoothly if network fails
            pass

    threading.Thread(target=task, daemon=True).start()
