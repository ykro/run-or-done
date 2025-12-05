# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "google-cloud-storage",
#     "google-cloud-firestore",
#     "python-dotenv",
#     "rich",
# ]
# ///

import os
from dotenv import load_dotenv
from google.cloud import storage, firestore
from google.api_core.exceptions import NotFound, Conflict
from rich.console import Console

console = Console()

def main():
    # Load env vars
    load_dotenv(".env.local", override=True)
    
    project_id = os.getenv("GCP_PROJECT_ID")
    bucket_name = os.getenv("GCS_BUCKET_NAME")
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    if not all([project_id, bucket_name, creds_path]):
        console.print("[red]Error: Missing one or more required env vars (GCP_PROJECT_ID, GCS_BUCKET_NAME, GOOGLE_APPLICATION_CREDENTIALS). Check .env.local[/red]")
        return

    console.print(f"[bold blue]Setup GCP Resources for Project: {project_id}[/bold blue]")
    console.print(f"Bucket Env: {bucket_name}")
    console.print(f"Credentials Env: {creds_path}")

    # Check credentials file
    if not os.path.exists(creds_path):
        console.print(f"[red]Error: Credentials file not found at {creds_path}[/red]")
        return
    
    database_id = os.getenv("FIRESTORE_DATABASE_ID", "(default)")

    # Initialize Clients
    try:
        # storage.Client will automatically pick up GOOGLE_APPLICATION_CREDENTIALS env var if set, 
        # but load_dotenv sets it via os.environ for the process.
        storage_client = storage.Client(project=project_id)
        db = firestore.Client(project=project_id, database=database_id)
    except Exception as e:
         console.print(f"[red]Failed to initialize GCP clients: {e}[/red]")
         return

    # 1. Bucket Setup
    console.print("\n[bold]Checking Cloud Storage...[/bold]")
    try:
        bucket = storage_client.bucket(bucket_name)
        if not bucket.exists():
            console.print(f"Bucket {bucket_name} not found. Creating...", end="")
            try:
                bucket.create(location="US") 
                console.print(" [green]Created[/green]")
            except Exception as create_err:
                console.print(f" [red]Failed: {create_err}[/red]")
        else:
            console.print(f"Bucket {bucket_name} [green]Exists[/green]")
        
        # Smoke Test GCS
        console.print("Running GCS Smoke Test...", end="")
        blob = bucket.blob("smoke_test.txt")
        blob.upload_from_string("test content")
        blob.delete()
        console.print(" [green]Success (Write/Delete)[/green]")
        
    except Exception as e:
        console.print(f"\n[red]GCS Error: {e}[/red]")

    # 2. Firestore Setup
    console.print("\n[bold]Checking Firestore...[/bold]")
    try:
        # Firestore creation often requires Console, so we check access by writing
        console.print("Running Firestore Smoke Test...", end="")
        doc_ref = db.collection("smoke_tests").document("setup_test_doc")
        
        # Write
        doc_ref.set({"status": "ok", "timestamp": firestore.SERVER_TIMESTAMP})
        
        # Read
        doc = doc_ref.get()
        if not doc.exists:
             raise Exception("Document not found after write")
             
        # Delete
        doc_ref.delete()
        console.print(" [green]Success (Write/Read/Delete)[/green]")
        
    except Exception as e:
        console.print(f"\n[red]Firestore Error: {e}[/red]")
        console.print("[yellow]Hint: If this failed, ensure the Firestore Database is created in 'Native Mode' in the Google Cloud Console.[/yellow]")

    console.print("\n[bold green]Setup Check Complete.[/bold green]")

if __name__ == "__main__":
    main()
