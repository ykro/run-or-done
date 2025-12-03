#!/bin/bash

# Load API Key from .env.local if it exists
if [ -f .env.local ]; then
  echo "Reading GEMINI_API_KEY from .env.local..."
  # Extract the key, handling potential quotes and whitespace
  GEMINI_API_KEY=$(grep "^GEMINI_API_KEY=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
fi

# Check if key was found
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY not found."
  echo "Please ensure it is set in .env.local or exported as an environment variable."
  exit 1
fi

echo "Deploying Run-or-Done to Google Cloud Run..."

# Deploy to Cloud Run
gcloud run deploy run-or-done \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY

echo "Deployment initiated."
