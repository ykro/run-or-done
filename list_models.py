# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "google-genai",
#     "python-dotenv",
# ]
# ///

import os
from dotenv import load_dotenv
from google import genai

load_dotenv(dotenv_path=".env.local", override=True)
api_key = os.getenv("GEMINI_API_KEY")

client = genai.Client(api_key=api_key)

try:
    # The SDK might have a different way to list models, checking common patterns
    # For google-genai SDK (v0.x or v1.x), it's usually client.models.list()
    # But let's check the exact method if possible or just try standard
    print("Listing models...")
    for model in client.models.list():
        print(model.name)
except Exception as e:
    print(f"Error listing models: {e}")
