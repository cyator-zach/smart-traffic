import threading
import time
from database import get_db, db_get_all_lanes, db_set_light
from firebase import firebase_sync_all

class TrafficLightController:
    SEQUENCE = ["a", "b", "c"]
    YELLOW_DURATION = 3

    def __init__(self):
        self._current_index = 0
        self._phase = "green"
        self._remaining = 0
        self._lock = threading.Lock()
        self._running = False
        self._thread = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._set_all_red_except(self.SEQUENCE[self._current_index])
        data = db_get_all_lanes()
        active_lane = self.SEQUENCE[self._current_index]
        lane_data = next((d for d in data if d["lane"] == active_lane), None)
        green_dur = lane_data["green_duration"] if lane_data else 10
        self._remaining = green_dur
        self._phase = "green"
        db_set_light(active_lane, "GREEN", self._remaining)

        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        print("[INFO] Traffic Light Controller dimulai.")

    def _set_all_red_except(self, active_lane: str):
        for lane in self.SEQUENCE:
            if lane != active_lane:
                db_set_light(lane, "RED", 0)

    def _run_loop(self):
        while self._running:
            time.sleep(1)
            with self._lock:
                if self._remaining > 0:
                    self._remaining -= 1
                    active_lane = self.SEQUENCE[self._current_index]
                    conn = get_db()
                    conn.execute(
                        "UPDATE traffic_data SET countdown=? WHERE lane=?",
                        (self._remaining, active_lane)
                    )
                    conn.commit()
                    conn.close()
                    firebase_sync_all()
                else:
                    if self._phase == "green":
                        self._phase = "yellow"
                        self._remaining = self.YELLOW_DURATION
                        active_lane = self.SEQUENCE[self._current_index]
                        db_set_light(active_lane, "YELLOW", self._remaining)
                    else:
                        old_lane = self.SEQUENCE[self._current_index]
                        db_set_light(old_lane, "RED", 0)

                        self._current_index = (self._current_index + 1) % len(self.SEQUENCE)
                        new_lane = self.SEQUENCE[self._current_index]

                        conn = get_db()
                        row = conn.execute(
                            "SELECT green_duration FROM traffic_data WHERE lane=?",
                            (new_lane,)
                        ).fetchone()
                        conn.close()
                        green_dur = row["green_duration"] if row else 10

                        self._remaining = green_dur
                        self._phase = "green"
                        db_set_light(new_lane, "GREEN", self._remaining)
                        self._set_all_red_except(new_lane)
                        print(f"[INFO] Pindah ke {new_lane.upper()} | Hijau {green_dur} detik")

    def stop(self):
        self._running = False

traffic_controller = TrafficLightController()
