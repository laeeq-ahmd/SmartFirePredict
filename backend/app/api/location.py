from fastapi import APIRouter
from pydantic import BaseModel
from app.core.state import location_state

router = APIRouter()

class LocationPayload(BaseModel):
    lat: float
    lon: float
    accuracy: float = 0.0

@router.post("/location")
async def update_location(payload: LocationPayload):
    """Receives GPS coordinates pushed from the frontend every 5 seconds."""
    location_state.update(payload.lat, payload.lon, payload.accuracy)
    return {"status": "ok"}
