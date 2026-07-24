import sqlite3
from datetime import datetime
from config import DB_PATH
from firebase import firebase_sync_all

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS traffic_data (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            lane          TEXT    NOT NULL UNIQUE,
            car           INTEGER DEFAULT 0,
            motorcycle    INTEGER DEFAULT 0,
            bus           INTEGER DEFAULT 0,
            truck         INTEGER DEFAULT 0,
            total_vehicle INTEGER DEFAULT 0,
            density       TEXT    DEFAULT 'SEPI',
            light_status  TEXT    DEFAULT 'RED',
            green_duration INTEGER DEFAULT 10,
            countdown     INTEGER DEFAULT 0,
            updated_at    TEXT    DEFAULT ''
        )
    """)

    for lane in ("a", "b", "c"):
        cur.execute(
            "INSERT OR IGNORE INTO traffic_data (lane, light_status, countdown) VALUES (?, 'RED', 0)",
            (lane,)
        )

    conn.commit()
    conn.close()
    print("[INFO] Database diinisialisasi.")

def db_get_all_lanes() -> list:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM traffic_data ORDER BY lane"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def db_update_lane(lane: str, car: int, motorcycle: int, bus: int, truck: int,
                    total: int, density: str, green_duration: int):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_db()
    conn.execute("""
        UPDATE traffic_data
        SET car=?, motorcycle=?, bus=?, truck=?,
            total_vehicle=?, density=?, green_duration=?,
            updated_at=?
        WHERE lane=?
    """, (car, motorcycle, bus, truck, total, density, green_duration, now, lane))
    conn.commit()
    conn.close()
    firebase_sync_all()

def db_set_light(lane: str, status: str, countdown: int):
    conn = get_db()
    conn.execute(
        "UPDATE traffic_data SET light_status=?, countdown=? WHERE lane=?",
        (status, countdown, lane)
    )
    conn.commit()
    conn.close()
    firebase_sync_all()
