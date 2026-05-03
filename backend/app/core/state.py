from app.core.stream import VideoStream
from app.core.detector import DetectionEngine

# Initialize globally accessible shared state
video_stream = VideoStream()
detector = DetectionEngine(video_stream)
