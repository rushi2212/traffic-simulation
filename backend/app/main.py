from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from .simulation import simulate

app = FastAPI(title="Flowstate Traffic Simulation API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                                                  "http://localhost:5174", "http://127.0.0.1:5174"],
                   allow_methods=["*"], allow_headers=["*"])


class Scenario(BaseModel):
    vehicles: int = Field(120, ge=20, le=500)
    duration_s: int = Field(240, ge=60, le=600)
    signal_cycle_s: int = Field(60, ge=30, le=120)
    arterial_lanes: int = Field(2, ge=1, le=4)
    local_lanes: int = Field(1, ge=1, le=2)
    flyover: bool = True
    seed: int = Field(7, ge=0, le=100000)


@app.get("/api/health")
def health():
    return {"status": "ok", "model": "microscopic agent-based traffic", "step_s": 1}


@app.post("/api/simulate")
def run_simulation(scenario: Scenario):
    try:
        return simulate(**scenario.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# In the Docker deployment, FastAPI serves the built React app from the same
# origin. During local development Vite serves the UI and proxies /api requests.
frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
