import threading

class LocationState:
    """Holds the latest GPS coordinates pushed from the frontend."""
    def __init__(self):
        self._lock    = threading.Lock()
        self.lat      = None
        self.lon      = None
        self.accuracy = None

    def update(self, lat: float, lon: float, accuracy: float):
        with self._lock:
            self.lat      = lat
            self.lon      = lon
            self.accuracy = accuracy

    def get(self) -> dict:
        with self._lock:
            return {"lat": self.lat, "lon": self.lon, "accuracy": self.accuracy}
