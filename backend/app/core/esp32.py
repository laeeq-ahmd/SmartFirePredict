import serial
import serial.tools.list_ports
import threading
import time

BAUD_RATE = 115200
RETRY_INTERVAL = 5  # seconds between reconnect attempts

class ESP32Monitor:
    def __init__(self, location_state=None, telegram=None, twilio=None):
        self.location_state = location_state
        self.telegram       = telegram
        self.twilio         = twilio
        self.is_connected = False
        self.last_temp     = None
        self.last_rise     = None
        self.last_flame    = None
        self.last_gas      = None
        self.port          = None
        self._serial       = None
        self._thread       = None
        self._running      = False
        self._lock         = threading.Lock()

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        print("[ESP32] Monitor started.")

    def stop(self):
        self._running = False
        if self._serial and self._serial.is_open:
            self._serial.close()
        print("[ESP32] Monitor stopped.")

    def _find_port(self):
        """Scan all COM ports and try to find the ESP32."""
        ports = serial.tools.list_ports.comports()
        for p in ports:
            desc = (p.description or "").lower()
            # CP210x and CH340 are the two most common ESP32 USB chips
            if any(k in desc for k in ["cp210", "ch340", "uart", "usb serial", "usb-serial"]):
                print(f"[ESP32] Found likely ESP32 on {p.device} ({p.description})")
                return p.device
        # Fallback: try all ports
        for p in ports:
            try:
                s = serial.Serial(p.device, BAUD_RATE, timeout=1)
                line = s.readline().decode("utf-8", errors="ignore").strip()
                s.close()
                if "Temp" in line or "Flame" in line or "Gas" in line:
                    print(f"[ESP32] Identified ESP32 on {p.device} via data match.")
                    return p.device
            except Exception:
                continue
        return None

    def _monitor_loop(self):
        while self._running:
            port = self._find_port()
            if not port:
                print("[ESP32] No ESP32 found. Retrying in 5s...")
                with self._lock:
                    self.is_connected = False
                time.sleep(RETRY_INTERVAL)
                continue

            try:
                self._serial = serial.Serial(port, BAUD_RATE, timeout=2)
                self.port = port
                with self._lock:
                    self.is_connected = True
                print(f"[ESP32] Connected on {port} @ {BAUD_RATE} baud.")

                while self._running:
                    line = self._serial.readline().decode("utf-8", errors="ignore").strip()
                    if line:
                        self._parse(line)

            except Exception as e:
                print(f"[ESP32] Connection lost: {e}")
                with self._lock:
                    self.is_connected = False
                if self._serial and self._serial.is_open:
                    self._serial.close()
                time.sleep(RETRY_INTERVAL)

    def _parse(self, line: str):
        """
        Parses lines like:
        Temp: 36.70 | Rise: 0.01 | Flame: 0 | Gas: 0
        """
        try:
            parts = {k.strip(): v.strip() for k, v in
                     (seg.split(":") for seg in line.split("|") if ":" in seg)}
            with self._lock:
                if "Temp"  in parts: self.last_temp  = float(parts["Temp"])
                if "Rise"  in parts: self.last_rise  = float(parts["Rise"])
                if "Flame" in parts: self.last_flame = int(parts["Flame"])
                if "Gas"   in parts: self.last_gas   = int(parts["Gas"])
            
            self._check_hardware_alerts()
        except Exception:
            pass  # silently skip malformed lines

    def _check_hardware_alerts(self):
        """Trigger Telegram and Twilio if hardware sensors detect fire/smoke."""
        loc = self.location_state.get() if self.location_state else {}
        lat, lon = loc.get("lat"), loc.get("lon")

        # Prioritize fire (flame sensor)
        if self.last_flame == 1:
            if self.telegram: self.telegram.maybe_send("fire", 1.0, lat, lon, source="hardware")
            if self.twilio:   self.twilio.maybe_call("fire", 1.0, source="hardware")
        elif self.last_gas == 1:
            if self.telegram: self.telegram.maybe_send("smoke", 1.0, lat, lon, source="hardware")
            if self.twilio:   self.twilio.maybe_call("smoke", 1.0, source="hardware")
        else:
            if self.telegram: self.telegram.clear()
            if self.twilio:   self.twilio.clear()

    def get_data(self) -> dict:
        with self._lock:
            return {
                "connected": self.is_connected,
                "temp":      self.last_temp,
                "rise":      self.last_rise,
                "flame":     self.last_flame,
                "gas":       self.last_gas,
            }
