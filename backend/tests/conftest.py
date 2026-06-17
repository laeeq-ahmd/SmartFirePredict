import pytest
from unittest.mock import MagicMock

# ── Global Mocks for Hardware and External Services ──
# We use autouse=True so these mocks are automatically applied to every test,
# ensuring no test ever accidentally hits real hardware, network, or heavy models.

@pytest.fixture(autouse=True)
def mock_yolo(mocker):
    """Mocks the ultralytics YOLO model so weights aren't loaded."""
    mock_model = MagicMock()
    mock_model.names = {0: "fire", 1: "smoke"}
    return mocker.patch("app.core.detector.YOLO", return_value=mock_model)

@pytest.fixture(autouse=True)
def mock_videocapture(mocker):
    """Mocks cv2.VideoCapture to prevent webcam access."""
    mock_cap = MagicMock()
    mock_cap.isOpened.return_value = True
    mock_cap.read.return_value = (True, "mock_frame")
    return mocker.patch("app.core.stream.cv2.VideoCapture", return_value=mock_cap)

@pytest.fixture(autouse=True)
def mock_serial(mocker):
    """Mocks PySerial to prevent ESP32 hardware connections."""
    mock_ser = MagicMock()
    return mocker.patch("app.core.esp32.serial.Serial", return_value=mock_ser)

@pytest.fixture(autouse=True)
def mock_telegram_requests(mocker):
    """Mocks Telegram HTTP requests."""
    return mocker.patch("app.utils.telegram.requests.post")

@pytest.fixture(autouse=True)
def mock_twilio_client(mocker):
    """Mocks the Twilio REST Client."""
    mock_client = MagicMock()
    return mocker.patch("twilio.rest.Client", return_value=mock_client)
