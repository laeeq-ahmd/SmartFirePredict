import uvicorn
import sys
import os

# Load .env from the project root (Code/ directory)
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env'))

# Add backend dir to path so `app.xyz` imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("[SYSTEM] Starting SmartFirePredict Backend...")
    print("[SYSTEM] Application is running on: http://localhost:8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
