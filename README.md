# Run-or-Done

AI-Powered Running Shoe Forensic Analysis application.

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
   ```
22:    GEMINI_API_KEY=your_api_key_here
23:    # Google Cloud Config
24:    GCP_PROJECT_ID=your_project_id
25:    GCS_BUCKET_NAME=your_bucket_name
26:    FIRESTORE_DATABASE_ID=(default)
27:    # Local Auth (Not needed on Cloud Run)
28:    GOOGLE_APPLICATION_CREDENTIALS=.gcp/credentials.json
29:    ```
30: 
31: 3. Cloud Infrastructure Setup:
32:    Ensure your `.gcp/credentials.json` is present, then run the setup script to provision/validate resources:
33:    ```bash
34:    uv run setup_gcs.py
35:    ```
36: 
37: 4. Run locally:
38:    ```bash
39:    npm run dev
40:    ```
41: 
42: ## Deployment
43: 
44: To deploy to Google Cloud Run:
45: 
46: 1. Ensure `gcloud` is authenticated.
47: 2. Ensure `.env.local` contains all the variables listed above.
48: 3. Run the deployment script:
49:    ```bash
50:    ./deploy.sh
51:    ```
52:    The script will automatically inject your environment variables into the Cloud Run service.

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
