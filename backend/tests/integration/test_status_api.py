import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.state import detector, esp32_monitor

client = TestClient(app)

def test_status_api_low_risk(mocker):
    """Test /status endpoint under normal, no-detection conditions."""
    mocker.patch.object(detector, "get_latest_results", return_value={
        "fire": False, "smoke": False, "boxes": []
    })
    mocker.patch.object(esp32_monitor, "get_data", return_value={
        "connected": True, "temp": 25.0, "rise": False, "flame": 0, "gas": 0
    })
    
    response = client.get("/status")
    assert response.status_code == 200
    
    data = response.json()
    assert data["score"] == 0
    assert data["risk_level"] == "LOW"
    assert data["flame_sensor"] is False
    assert data["smoke_detected"] is False

def test_status_api_medium_risk(mocker):
    """Test /status endpoint when smoke is detected (MEDIUM risk)."""
    mocker.patch.object(detector, "get_latest_results", return_value={
        "fire": False, "smoke": True, "boxes": [{"class": "smoke", "confidence": 0.85}]
    })
    mocker.patch.object(esp32_monitor, "get_data", return_value={
        "connected": True, "temp": 28.0, "rise": False, "flame": 0, "gas": 0
    })
    
    response = client.get("/status")
    assert response.status_code == 200
    
    data = response.json()
    assert data["score"] == 65
    assert data["risk_level"] == "MEDIUM"
    assert data["smoke_detected"] is True
    assert data["flame_sensor"] is False
    assert len(data["detections"]) == 1

def test_status_api_high_risk(mocker):
    """Test /status endpoint when hardware flame sensor triggers (HIGH risk)."""
    mocker.patch.object(detector, "get_latest_results", return_value={
        "fire": False, "smoke": False, "boxes": []
    })
    mocker.patch.object(esp32_monitor, "get_data", return_value={
        "connected": True, "temp": 50.0, "rise": True, "flame": 1, "gas": 0
    })
    
    response = client.get("/status")
    assert response.status_code == 200
    
    data = response.json()
    assert data["score"] == 95
    assert data["risk_level"] == "HIGH"
    # Even if AI didn't detect fire, HW flame sensor triggers HIGH risk
