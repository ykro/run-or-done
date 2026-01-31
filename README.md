# Run-or-Done

AI-Powered Running Shoe Forensic Analysis application.

## Demo

Try the application live: [Run-or-Done on Cloud Run](https://run-or-done-622959071640.us-central1.run.app/)

![Analysis Result Preview](./assets/result_preview.png)

## Prerequisites

- Node.js 20+
- Google Cloud SDK (for deployment)
- Gemini API Key

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set Environment Variables:
   Create a `.env.local` file (optional for local dev, but recommended):
   ```
   GEMINI_API_KEY=your_api_key_here
   # Google Cloud Config
   GCP_PROJECT_ID=your_project_id
   GCS_BUCKET_NAME=your_bucket_name
   FIRESTORE_DATABASE_ID=(default)
   # Local Auth (Not needed on Cloud Run)
   GOOGLE_APPLICATION_CREDENTIALS=.gcp/credentials.json
   ```
 
3. Cloud Infrastructure Setup:
   Ensure your `.gcp/credentials.json` is present, then run the setup script to provision/validate resources:
   ```bash
   uv run setup_gcs.py
   ```
 
4. Run locally:
   ```bash
   npm run dev
   ```
 
## Deployment
 
To deploy to Google Cloud Run:
 
1. Ensure `gcloud` is authenticated.
2. Ensure `.env.local` contains all the variables listed above.
3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```
   The script will automatically inject your environment variables into the Cloud Run service.

## Docker

Build and run locally with Docker:

```bash
docker build -t run-or-done .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_api_key_here run-or-done
```

## CLI Testing

You can test the analysis logic directly from the command line using the provided Python script. This script mimics the application's context injection logic.

**Prerequisites:**
- `uv` (Python package manager) installed.
- `GEMINI_API_KEY` set in `.env.local`.

**Usage:**

1.  **Analyze a single image:**
    ```bash
    uv run test_analysis.py path/to/shoe.jpg
    ```

2.  **Analyze a directory of images:**
    ```bash
    uv run test_analysis.py path/to/images_folder/
    ```

The script will automatically install dependencies (`google-genai`, `rich`, `typer`, etc.) and output the JSON result to the console.
