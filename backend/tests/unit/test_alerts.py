import pytest
from app.core.alerts import AlertManager

def test_alert_threshold_trigger():
    """Verify that the alert only triggers after N consecutive detections."""
    manager = AlertManager(trigger_threshold=3)
    
    # 1st detection
    manager.update(fire_detected=True, smoke_detected=False)
    assert not manager.get_status()["active"]
    
    # 2nd detection
    manager.update(fire_detected=False, smoke_detected=True)
    assert not manager.get_status()["active"]
    
    # 3rd detection -> should trigger
    manager.update(fire_detected=True, smoke_detected=False)
    assert manager.get_status()["active"]

def test_alert_reset_behavior():
    """Verify that a single non-detection resets the active alert."""
    manager = AlertManager(trigger_threshold=2)
    
    # Trigger alert
    manager.update(fire_detected=True, smoke_detected=False)
    manager.update(fire_detected=True, smoke_detected=False)
    assert manager.get_status()["active"]
    
    # One clean frame -> clears alert
    manager.update(fire_detected=False, smoke_detected=False)
    assert not manager.get_status()["active"]

def test_alert_mixed_detections():
    """Verify that mixed fire/smoke detections count towards the threshold."""
    manager = AlertManager(trigger_threshold=2)
    
    manager.update(fire_detected=True, smoke_detected=False)
    manager.update(fire_detected=False, smoke_detected=True)
    
    assert manager.get_status()["active"]
