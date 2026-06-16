import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.state import alert_settings, telegram, twilio

client = TestClient(app)

def test_demo_mode_status_and_blocking(mocker):
    """
    Test that when Demo Mode is active:
    1. /status returns demo_mode = True
    2. Telegram and Twilio APIs internally block outward requests
    """
    # 1. Enable Demo Mode
    alert_settings.update(demo_mode=True)
    
    # Verify via /status
    response = client.get("/status")
    assert response.status_code == 200
    assert response.json()["demo_mode"] is True
    
    # 2. Trigger a fake alert directly on the notifiers
    # We will mock the print functions to see if they bypass external APIs properly,
    # or rely on the actual code logic (which returns early if demo_mode=True)
    
    # Attempt to send a telegram alert
    # The actual implementation checks alert_settings.get_all()["demo_mode"]
    telegram.maybe_send("fire", 0.95, 34.0, -118.0)
    
    # Attempt to send a twilio call
    twilio.maybe_call("fire", 0.95)
    
    # We assert that the requests.post mock was NOT called, because demo_mode caught it.
    import app.utils.telegram
    import app.utils.twilio_notifier
    
    # Since we used autouse fixtures in conftest, the mocks are already in place
    # We can fetch them via mocker.spy or just by importing the mocked object if needed.
    # However, since they were mocker.patched in conftest, we can check their call counts.
    # A cleaner way is to use mocker.patch again locally to get the explicit mock object 
    # to assert against.
    
    mock_post = mocker.patch("app.utils.telegram.requests.post")
    mock_call = mocker.patch("twilio.rest.Client")
    
    # Re-trigger to capture with these specific mocks
    telegram.maybe_send("fire", 0.95, 34.0, -118.0)
    twilio.maybe_call("fire", 0.95)
    
    assert mock_post.call_count == 0
    assert mock_call.call_count == 0
