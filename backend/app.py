"""
EcoSort backend — Flask REST API.

Endpoints:
    GET  /api/health
    POST /api/classify        { label }                 -> category + tip
    POST /api/scan            { user, label }            -> logs scan, awards points
    GET  /api/leaderboard
    POST /api/report          { user, lat, lng, note, severity } -> logs a dumping/overflow report
    GET  /api/reports
    GET  /api/schedule?zone=A
    GET  /api/stats

All storage is in-memory (Python dicts/lists), reset on server restart.
That's a deliberate choice for a hackathon MVP demo — swapping in
SQLite/Postgres later only touches this file.
"""

import time
import uuid

from flask import Flask, jsonify, request
from flask_cors import CORS

from data import (
    CATEGORY_TIPS,
    ZONE_SCHEDULES,
    POINTS_PER_SCAN,
    POINTS_PER_REPORT,
    classify_label,
)

app = Flask(__name__)
CORS(app)

# ---- in-memory "database" ----
leaderboard = {}   # user -> points
scans = []         # list of {id, user, label, category, ts}
reports = []       # list of {id, user, lat, lng, note, severity, ts}


def _bump_score(user: str, points: int) -> int:
    leaderboard[user] = leaderboard.get(user, 0) + points
    return leaderboard[user]


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "time": time.time()})


@app.post("/api/classify")
def classify():
    payload = request.get_json(force=True) or {}
    raw_label = payload.get("label", "")
    if not raw_label:
        return jsonify({"error": "label is required"}), 400

    category = classify_label(raw_label)
    info = CATEGORY_TIPS[category]
    return jsonify({
        "raw_label": raw_label,
        "category": category,
        "display": info["label"],
        "color": info["color"],
        "tip": info["tip"],
    })


@app.post("/api/scan")
def scan():
    payload = request.get_json(force=True) or {}
    user = payload.get("user", "guest")
    raw_label = payload.get("label", "unknown")
    category = classify_label(raw_label)

    entry = {
        "id": str(uuid.uuid4()),
        "user": user,
        "label": raw_label,
        "category": category,
        "ts": time.time(),
    }
    scans.append(entry)
    new_score = _bump_score(user, POINTS_PER_SCAN)

    return jsonify({"scan": entry, "points_awarded": POINTS_PER_SCAN, "total_points": new_score})


@app.get("/api/leaderboard")
def get_leaderboard():
    ranked = sorted(leaderboard.items(), key=lambda kv: kv[1], reverse=True)
    return jsonify([{"user": u, "points": p, "rank": i + 1} for i, (u, p) in enumerate(ranked)])


@app.post("/api/report")
def report():
    payload = request.get_json(force=True) or {}
    required = ("user", "lat", "lng")
    if not all(k in payload for k in required):
        return jsonify({"error": f"required fields: {required}"}), 400

    entry = {
        "id": str(uuid.uuid4()),
        "user": payload["user"],
        "lat": payload["lat"],
        "lng": payload["lng"],
        "note": payload.get("note", ""),
        "severity": payload.get("severity", "medium"),
        "ts": time.time(),
    }
    reports.append(entry)
    new_score = _bump_score(payload["user"], POINTS_PER_REPORT)

    return jsonify({"report": entry, "points_awarded": POINTS_PER_REPORT, "total_points": new_score})


@app.get("/api/reports")
def get_reports():
    return jsonify(reports)


@app.get("/api/schedule")
def schedule():
    zone = request.args.get("zone", "A").upper()
    zone_data = ZONE_SCHEDULES.get(zone)
    if not zone_data:
        return jsonify({"error": "unknown zone", "valid_zones": list(ZONE_SCHEDULES.keys())}), 404
    return jsonify({"zone": zone, "pickup_days": zone_data})


@app.get("/api/stats")
def stats():
    breakdown = {}
    for s in scans:
        breakdown[s["category"]] = breakdown.get(s["category"], 0) + 1
    return jsonify({
        "total_scans": len(scans),
        "total_reports": len(reports),
        "active_users": len(leaderboard),
        "category_breakdown": breakdown,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
