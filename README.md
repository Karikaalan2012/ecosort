# EcoSort
**Sort it right, right now.** A browser-based waste-management platform built for DeltaHacks 13 (theme: garbage management — application track, not robotics).

---

## The problem

Municipal recycling contamination rates sit around **25%** in most North American cities — one wrong item in a recycling bin can get the whole load landfilled. Meanwhile, cities have no real-time visibility into overflowing bins or illegal dumping between scheduled truck routes, and residents have no easy way to flag it. Both problems come down to the same gap: **information isn't where the decision gets made** — at the bin, and at the depot.

## The solution

EcoSort is a single web app with three connected pieces:

1. **Instant Sort** — point your phone camera (or upload a photo) at an item. A vision model running *in the browser* identifies it and maps it to the correct waste stream — recyclable, compost, landfill, or hazardous/e-waste — with a one-line disposal tip. No photo ever leaves the device for classification.
2. **Community Report Map** — click a spot on the map to flag an overflowing bin or illegal dumping, tagged by severity. Reports land on a live map instantly, so a city ops team (or a hackathon judge) can see hotspots forming in real time.
3. **Gamified accountability** — every scan and every report earns points onto a leaderboard, turning correct sorting into a habit instead of a chore, and turning reporting into something a neighborhood competes over.

A **City Dashboard** rolls all of it up: total scans, total reports, active users, and a live category breakdown chart — the kind of view a municipal waste-management office would actually want.

## Why this wins

- **Real application, not a gimmick**: it directly attacks contamination (the #1 cost driver in municipal recycling) and reporting latency (the #1 complaint in 311 systems), with a UI a city could plausibly pilot next quarter.
- **Runs entirely client-side for the hard part**: classification uses a pretrained MobileNet model loaded via TensorFlow.js — zero training data collection, zero GPU cost, zero server round-trip for the camera feed. That's a deliberately scrappy, deployable architecture, not a hand-wave.
- **Full loop, not a single feature**: scan → sort → report → leaderboard → city dashboard is an actual product loop, demoable end-to-end in under two minutes.
- **Backend is real and tested**: a Flask REST API backs classification mapping, scoring, reports, and stats — and the frontend degrades gracefully to a local fallback if the backend isn't running, so the demo never breaks on stage.

## Architecture

```
┌─────────────────────────────┐        ┌───────────────────────────┐
│         Browser              │        │      Flask API (Python)    │
│                              │        │                            │
│  TensorFlow.js + MobileNet   │        │  /api/classify             │
│  (on-device image labeling) │──JSON──▶│  /api/scan                │
│                              │        │  /api/report               │
│  Leaflet map (report pins)  │◀──────│  /api/reports               │
│  Chart.js (city dashboard)  │        │  /api/leaderboard           │
│                              │        │  /api/schedule              │
│  Local fallback logic if    │        │  /api/stats                 │
│  API is unreachable         │        │  (in-memory store)          │
└─────────────────────────────┘        └───────────────────────────┘
```

- **Frontend**: `frontend/index.html`, `style.css`, `app.js` — vanilla JS, no build step.
- **Backend**: `backend/app.py`, `data.py` — Flask + flask-cors, in-memory storage (swap in SQLite/Postgres for production, isolated to `data.py`/`app.py`).
- **Vision**: MobileNet (ImageNet-pretrained) loaded client-side; a keyword table maps its ~1000 class labels to one of four waste streams — no custom training needed for an MVP, and it's a clean seam to later swap in a fine-tuned model trained on real bin photos.

## Tech stack

| Layer | Choice |
|---|---|
| Vision model | TensorFlow.js + MobileNet (client-side) |
| Frontend | HTML / CSS / vanilla JS, Leaflet.js (map), Chart.js (dashboard) |
| Backend | Python, Flask, flask-cors |
| Data | In-memory (JSON-serializable), zero external DB dependency for the demo |

## Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py        # runs on http://127.0.0.1:5000
```

**Frontend:**
```bash
cd frontend
python3 -m http.server 8000   # or just open index.html directly
```
Then visit `http://127.0.0.1:8000`. Allow camera access when prompted, or use "Upload Photo" if running somewhere without a camera.

> The frontend works even with the backend off — it falls back to an identical client-side scoring/classification path — but running both shows the full stack.

## Demo script (2 minutes)

1. **Scan tab** — upload/point at a water bottle → watch it animate down the sorting line into "Recyclable," see the disposal tip and points tick up.
2. Scan a banana peel → lands in "Compost." Scan a battery → lands in "Hazardous." Show the model isn't just checking one hardcoded item.
3. **Report Map** — click a spot near campus, mark it "High severity, overflowing," submit. Point out the pin appearing live and the points awarded.
4. **Leaderboard** — show your points climbing.
5. **City Dashboard** — show the category breakdown chart updating with everything just scanned, and frame it as "this is the view a city's waste-management office would actually watch."

## Roadmap (post-hackathon)

- Fine-tune a custom vision model on real curbside-bin photos to beat generic ImageNet accuracy on ambiguous items (e.g. greasy pizza boxes).
- Real municipal API integration for pickup schedules (currently mocked by zone).
- Push notifications the night before pickup, keyed to your address.
- Verified reports (photo-confirmed) feeding directly into a city's 311/work-order system.
- Persistent storage (Postgres) + auth, replacing the in-memory demo store.

---
Built for DeltaHacks 13 · garbage management, application track.
