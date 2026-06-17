import pytest
import os
import json
from app.core.settings import AlertSettings

@pytest.fixture
def temp_settings_file(tmp_path, monkeypatch):
    """Overrides SETTINGS_FILE to a temporary path to avoid corrupting real user settings."""
    temp_file = tmp_path / "test_settings.json"
    monkeypatch.setattr("app.core.settings.SETTINGS_FILE", str(temp_file))
    return temp_file

def test_settings_default_initialization(temp_settings_file):
    """Verify settings initialize to expected defaults when no file exists."""
    settings = AlertSettings()
    
    data = settings.get_all()
    assert data["fire_alerts"] is True
    assert data["smoke_alerts"] is True
    assert data["telegram_alerts"] is True
    assert data["twilio_alerts"] is False
    assert data["demo_mode"] is True

def test_settings_update_and_persistence(temp_settings_file):
    """Verify updating settings saves to the file and reloading reads from the file."""
    # Initialize and update
    settings = AlertSettings()
    settings.update(fire=False, twilio=True, demo_mode=False)
    
    # Check memory state
    data = settings.get_all()
    assert data["fire_alerts"] is False
    assert data["twilio_alerts"] is True
    assert data["demo_mode"] is False
    
    # Check file state
    assert os.path.exists(temp_settings_file)
    with open(temp_settings_file, "r") as f:
        file_data = json.load(f)
        assert file_data["fire_alerts"] is False
        assert file_data["twilio_alerts"] is True
        assert file_data["demo_mode"] is False
        
    # Check reload state (simulating a backend restart)
    new_settings = AlertSettings()
    new_data = new_settings.get_all()
    assert new_data["fire_alerts"] is False
    assert new_data["twilio_alerts"] is True
    assert new_data["demo_mode"] is False
