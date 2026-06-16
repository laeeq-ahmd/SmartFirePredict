import pytest
from app.core.location_state import LocationState

def test_location_state_initialization():
    """Verify default initialization of LocationState."""
    state = LocationState()
    data = state.get()
    
    assert data["lat"] is None
    assert data["lon"] is None
    assert data["accuracy"] is None

def test_location_state_sequential_updates():
    """Verify that multiple sequential updates correctly overwrite state and are retrieved properly."""
    state = LocationState()
    
    # Update 1
    state.update(lat=34.0522, lon=-118.2437, accuracy=10.5)
    data1 = state.get()
    assert data1["lat"] == 34.0522
    assert data1["lon"] == -118.2437
    assert data1["accuracy"] == 10.5
    
    # Update 2
    state.update(lat=40.7128, lon=-74.0060, accuracy=5.0)
    data2 = state.get()
    assert data2["lat"] == 40.7128
    assert data2["lon"] == -74.0060
    assert data2["accuracy"] == 5.0
