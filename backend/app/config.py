import os

class Settings:
    # --- Model Settings ---
    MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "best.pt"))
    CONFIDENCE_THRESHOLD = 0.15
    FRAME_SIZE = (640, 640)

    # --- Detection Settings ---
    FRAME_SKIP = 2

    # --- Alert Settings ---
    ALERT_CONSECUTIVE_FRAMES = 5

    # --- Stream Settings ---
    DEFAULT_FPS_TARGET = 20

config = Settings()
