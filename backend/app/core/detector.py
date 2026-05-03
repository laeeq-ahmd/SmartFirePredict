import threading
import time
from ultralytics import YOLO
from app.config import config
from app.core.alerts import AlertManager

class DetectionEngine:
    def __init__(self, video_stream):
        self.video_stream = video_stream
        self.model = None
        self.alert_manager = AlertManager(trigger_threshold=config.ALERT_CONSECUTIVE_FRAMES)
        
        self.latest_annotated_frame = None
        self.latest_results = {
            "fire": False,
            "smoke": False,
            "confidence": 0.0,
            "boxes": [],
            "alert_active": False
        }
        self.lock = threading.Lock()
        
        self.running = False
        self.thread = None

    def start(self):
        if self.running:
            return
            
        print("[DETECTOR] Loading YOLO model...")
        try:
            self.model = YOLO(config.MODEL_PATH)
            print("[DETECTOR] Model loaded successfully.")
        except Exception as e:
            print(f"[DETECTOR] Error loading model: {e}")
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._process_loop, daemon=True)
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
            fire_detected = False
            smoke_detected = False
            max_conf = 0.0
            boxes_data = []

            if len(results) > 0:
                r = results[0]
                annotated_frame = r.plot()
                
                for box in r.boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    class_name = self.model.names[cls_id].lower()
                    
                    boxes_data.append({
                        "class": class_name,
                        "confidence": conf,
                        "xyxy": box.xyxy[0].tolist()
                    })
                    
                    if conf > max_conf:
                        max_conf = conf
                        
                    if "fire" in class_name or "flame" in class_name:
                        fire_detected = True
                    if "smoke" in class_name:
                        smoke_detected = True

            self.alert_manager.update(fire_detected, smoke_detected)

            with self.lock:
                self.latest_annotated_frame = annotated_frame
                self.latest_results = {
                    "fire": fire_detected,
                    "smoke": smoke_detected,
                    "confidence": max_conf,
                    "boxes": boxes_data,
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
        if self.thread is not None:
            self.thread.join(timeout=1.0)
        print("[DETECTOR] Inference stopped.")
