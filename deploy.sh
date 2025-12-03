#!/bin/bash

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY environment variable is not set."
  echo "Please export GEMINI_API_KEY='your-api-key' and try again."
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
