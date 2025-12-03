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
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

## Deployment

To deploy to Google Cloud Run:

1. Ensure you have `gcloud` installed and authenticated.
2. Export your Gemini API Key:
   ```bash
   export GEMINI_API_KEY=your_api_key_here
   ```
3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

## Docker

Build and run locally with Docker:

```bash
docker build -t run-or-done .
docker run -p 3000:3000 -e GEMINI_API_KEY=your_api_key_here run-or-done
```
