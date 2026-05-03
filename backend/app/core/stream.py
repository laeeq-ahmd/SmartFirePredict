import cv2
import threading
import time
import numpy as np

class VideoStream:
    def __init__(self):
        self.stream_url = None
        self.capture = None
        self.latest_frame = None
        
        self.lock = threading.Lock()
        self.running = False
        self.thread = None

    def start(self, source):
        self.stop()
        self.stream_url = source
        
        try:
            cam_index = int(self.stream_url)
            self.capture = cv2.VideoCapture(cam_index)
        except ValueError:
            self.capture = cv2.VideoCapture(self.stream_url)
            
        if not self.capture.isOpened():
            print(f"[STREAM] Failed to open source: {self.stream_url}")
            return False

        print(f"[STREAM] Connected to {self.stream_url}")
        
        self.running = True
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()
        return True

    def _update(self):
        print("[STREAM] Thread started. Waiting for frames...")
        frames_grabbed = 0
        
        while self.running:
            if not self.capture.isOpened():
                break

            ret = self.capture.grab()
            if not ret:
                time.sleep(0.01)
                continue

            ret, frame = self.capture.retrieve()
            if ret:
                frames_grabbed += 1
                if frames_grabbed == 1 or frames_grabbed % 100 == 0:
                    print(f"[STREAM] Successfully grabbed {frames_grabbed} frames. Resolution: {frame.shape[1]}x{frame.shape[0]}")
                with self.lock:
                    self.latest_frame = frame.copy()
            else:
                time.sleep(0.01)
                
        print("[STREAM] Thread exited.")

    def read(self) -> np.ndarray:
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
        return None

    def stop(self):
        self.running = False
        if self.thread is not None:
            self.thread.join(timeout=1.0)
        if self.capture is not None:
            self.capture.release()
        self.latest_frame = None
        print("[STREAM] Capture stopped.")
