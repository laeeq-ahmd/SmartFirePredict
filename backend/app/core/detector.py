import threading
import time
from ultralytics import YOLO
from app.config import config
from app.core.alerts import AlertManager

class DetectionEngine:
    def __init__(self, video_stream, location_state=None, telegram=None, twilio=None, alert_settings=None):
        self.video_stream   = video_stream
        self.location_state = location_state
        self.telegram       = telegram
        self.twilio         = twilio
        self.alert_settings = alert_settings
        self.model          = None
        self.alert_manager  = AlertManager(trigger_threshold=config.ALERT_CONSECUTIVE_FRAMES)

        self.latest_annotated_frame = None
        self.latest_results = {
            "fire": False, "smoke": False,
            "confidence": 0.0, "boxes": [], "alert_active": False
        }
        self.lock    = threading.Lock()
        self.running = False
        self.thread  = None

    def start(self):
        if self.running:
            return
        print("[DETECTOR] Loading YOLO model...")
        try:
            self.model = YOLO(config.MODEL_PATH)
            print(f"[DETECTOR] Model loaded. Classes: {self.model.names}")
        except Exception as e:
            print(f"[DETECTOR] Error loading model: {e}")
            return
        self.running = True
        self.thread  = threading.Thread(target=self._process_loop, daemon=True)
        self.thread.start()

    def _process_loop(self):
        frame_counter = 0
        while self.running:
            frame = self.video_stream.read()
            if frame is None:
                time.sleep(0.01)
                continue

            frame_counter += 1
            if frame_counter % config.FRAME_SKIP != 0:
                with self.lock:
                    if self.latest_annotated_frame is None:
                        self.latest_annotated_frame = frame.copy()
                continue

            results = self.model.predict(
                source=frame,
                conf=config.CONFIDENCE_THRESHOLD,
                imgsz=config.FRAME_SIZE[0],
                verbose=False
            )

            annotated_frame = frame.copy()
            fire_detected   = False
            smoke_detected  = False
            max_conf        = 0.0
            best_class      = None
            boxes_data      = []

            if len(results) > 0:
                r = results[0]
                annotated_frame = r.plot()
                for box in r.boxes:
                    cls_id     = int(box.cls[0])
                    conf       = float(box.conf[0])
                    class_name = self.model.names[cls_id].lower()
                    boxes_data.append({
                        "class": class_name,
                        "confidence": conf,
                        "xyxy": box.xyxy[0].tolist()
                    })
                    if conf > max_conf:
                        max_conf   = conf
                        best_class = class_name
                    if "fire" in class_name or "flame" in class_name:
                        fire_detected = True
                    if "smoke" in class_name:
                        smoke_detected = True

            self.alert_manager.update(fire_detected, smoke_detected)

            # Check global fire/smoke alert toggles
            settings = self.alert_settings.get_all() if self.alert_settings else {"fire_alerts": True, "smoke_alerts": True}
            fire_enabled = settings["fire_alerts"]
            smoke_enabled = settings["smoke_alerts"]

            is_alertable = best_class and (
                (best_class == "fire" and fire_enabled) or
                (best_class == "smoke" and smoke_enabled)
            )

            # Telegram notifications
            if self.telegram and is_alertable:
                loc = self.location_state.get() if self.location_state else {}
                self.telegram.maybe_send(best_class, max_conf, loc.get("lat"), loc.get("lon"))
            elif self.telegram:
                self.telegram.clear()

            # Twilio call notifications
            if self.twilio and is_alertable:
                self.twilio.maybe_call(best_class, max_conf)
            elif self.twilio:
                self.twilio.clear()

            with self.lock:
                self.latest_annotated_frame = annotated_frame
                self.latest_results = {
                    "fire":         fire_detected,
                    "smoke":        smoke_detected,
                    "confidence":   max_conf,
                    "boxes":        boxes_data,
                    "alert_active": self.alert_manager.is_alert_active
                }

    def get_latest_frame(self):
        with self.lock:
            if self.latest_annotated_frame is not None:
                return self.latest_annotated_frame.copy()
        return None

    def get_latest_results(self):
        with self.lock:
            return self.latest_results.copy()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        print("[DETECTOR] Inference stopped.")
