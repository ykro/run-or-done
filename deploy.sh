#!/bin/bash

# Function to extract value from .env.local handling exports, quotes, and comments
get_env_val() {
    # grep ignore comments, find key, take last occurrence, cut after =, trim whitespace and quotes
    grep -v '^#' .env.local | grep -E "^\s*(export\s+)?$1=" | tail -n 1 | cut -d '=' -f2- | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//'
}

# Load Variables from .env.local if it exists
if [ -f .env.local ]; then
  echo "Reading configuration from .env.local..."
  
  GEMINI_API_KEY=$(get_env_val "GEMINI_API_KEY")
  GCP_PROJECT_ID=$(get_env_val "GCP_PROJECT_ID")
  GCS_BUCKET_NAME=$(get_env_val "GCS_BUCKET_NAME")
  FIRESTORE_DATABASE_ID=$(get_env_val "FIRESTORE_DATABASE_ID")

  # Debug print (masking key)
  if [ ! -z "$GEMINI_API_KEY" ]; then
    echo "Found GEMINI_API_KEY (masked): ${GEMINI_API_KEY:0:5}..."
  else
    echo "GEMINI_API_KEY not found in .env.local"
  fi
fi

# Check if key was found
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY not found."
  echo "Please ensure it is set in .env.local or exported as an environment variable."
  exit 1
fi

if [ -z "$GCP_PROJECT_ID" ]; then
    echo "Warning: GCP_PROJECT_ID not found in .env.local. gcloud usually detects this, but explicit is better."
fi

echo "Deploying Run-or-Done to Google Cloud Run..."
echo "Project: $GCP_PROJECT_ID"
echo "Region: us-central1"

# Deploy to Cloud Run
# Note: GOOGLE_APPLICATION_CREDENTIALS is NOT passed. Cloud Run uses its assigned Service Account.
gcloud run deploy run-or-done \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="$GEMINI_API_KEY",GCP_PROJECT_ID="$GCP_PROJECT_ID",GCS_BUCKET_NAME="$GCS_BUCKET_NAME",FIRESTORE_DATABASE_ID="$FIRESTORE_DATABASE_ID"

echo "Deployment initiated."
