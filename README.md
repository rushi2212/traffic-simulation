# Flowstate — Traffic Network Lab

A full-stack agent-based traffic simulator. Choose a baseline, rush-hour, flyover-closed, or capacity-upgrade scenario; change demand, lane counts, signal cycle, and random seed; run the model; then play back traffic and inspect queues, link utilization, trip metrics, and a CSV export.

## Start on Windows

Terminal 1 — backend:

```powershell
cd C:\Users\rushi\OneDrive\Desktop\IIsc\traffic-simulation\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Terminal 2 — frontend:

```powershell
cd C:\Users\rushi\OneDrive\Desktop\IIsc\traffic-simulation\frontend
npm install
npm run dev
```

Open http://127.0.0.1:5174. FastAPI docs: http://127.0.0.1:8001/docs. Port 8001 keeps the traffic app separate from the PDE project's API port.

## Deploy to Render

The repository includes a Dockerfile and `render.yaml`. The container builds the React UI and serves it with FastAPI, so the UI and `/api` endpoints use one public URL.

1. Push this project folder to a GitHub repository.
2. In Render, choose **New → Blueprint**, connect that repository, and apply the `render.yaml` service definition.
3. Wait for the deploy to pass its `/api/health` check, then open the `onrender.com` URL shown for the service.

You can also deploy it as a Docker web service by connecting the repository and using the project root as the Docker context. Render supplies `PORT`; the container binds to it on `0.0.0.0`.

For a local container preview, run `docker build -t flowstate-traffic .` from the project root, then `docker run --rm -p 10000:10000 flowstate-traffic` and open http://localhost:10000.

## Model

The network is a 3×3 junction grid with a separate N2–N6 flyover. Each vehicle is an agent with an origin, destination, route, position, speed, and lane. Agents choose a minimum-travel-time path, follow a lead vehicle in their lane, stop at red signals, and wait when the next road's lane storage is full. Lane counts affect usable storage. The simulation uses one-second steps and records two-second playback frames. A fixed random seed makes runs repeatable.

The model is a teaching/demo simulation with simplified signal phases and car-following. The CO₂ value is a distance-based estimate; results are not calibrated for operational traffic engineering.
