from fastapi import APIRouter
from app.core.state import detector

router = APIRouter()

@router.get("/detections")
async def get_detections():
    """Returns the latest YOLO inference results and alert state."""
    return detector.get_latest_results()
