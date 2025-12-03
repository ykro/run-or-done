# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "google-genai",
#     "python-dotenv",
#     "typer",
#     "rich",
#     "pillow",
# ]
# ///

import os
import sys
from pathlib import Path
from typing import List, Optional
import typer
from dotenv import load_dotenv
from google import genai
from google.genai import types
from rich.console import Console
from rich.panel import Panel
from rich.json import JSON
from rich.progress import Progress, SpinnerColumn, TextColumn
from PIL import Image

app = typer.Typer()
console = Console()

# Defined views from the application logic
EXPECTED_VIEWS = ["OUTSOLE", "LATERAL", "MEDIAL", "HEEL", "TOP"]

def load_api_key():
    """Load API key from .env.local"""
    env_path = Path(".env.local")
    if env_path.exists():
        load_dotenv(dotenv_path=env_path, override=True)
    
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        console.print("[bold red]Error:[/bold red] GEMINI_API_KEY not found in .env.local or environment variables.")
        raise typer.Exit(code=1)
    
    return api_key

def get_system_prompt() -> str:
    """Read the system prompt from analysis.md"""
    try:
        return Path("analysis.md").read_text(encoding="utf-8")
    except FileNotFoundError:
        console.print("[bold red]Error:[/bold red] analysis.md not found in current directory.")
        raise typer.Exit(code=1)

def infer_view_from_filename(filename: str) -> Optional[str]:
    """Try to guess the view based on the filename"""
    fname = filename.upper()
    for view in EXPECTED_VIEWS:
        if view in fname:
            return view
    return None

def resize_image(image: Image.Image, max_dimension: int = 1568) -> Image.Image:
    """
    Resize image maintaining aspect ratio so the longest side does not exceed max_dimension.
    """
    width, height = image.size
    if max(width, height) <= max_dimension:
        return image
    
    scale = max_dimension / max(width, height)
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    return image.resize((new_width, new_height), Image.Resampling.LANCZOS)

@app.command()
def analyze(
    input_path: Path = typer.Argument(..., help="Path to an image file or directory of images")
):
    """
    Run the shoe analysis on the provided image(s) using gemini-3-pro-preview.
    """
    api_key = load_api_key()
    client = genai.Client(api_key=api_key)
    
    system_prompt = get_system_prompt()
    
    image_files = []
    if input_path.is_file():
        image_files = [input_path]
    elif input_path.is_dir():
        image_files = sorted([
            p for p in input_path.iterdir() 
            if p.suffix.lower() in ['.jpg', '.jpeg', '.png', '.webp', '.heic']
        ])
    else:
        console.print(f"[bold red]Error:[/bold red] Invalid input path: {input_path}")
        raise typer.Exit(code=1)

    if not image_files:
        console.print("[bold red]Error:[/bold red] No image files found.")
        raise typer.Exit(code=1)

    # Prepare inputs
    present_views = []
    missing_views = []
    image_parts = []
    
    console.print(f"[bold blue]Found {len(image_files)} images:[/bold blue]")
    
    # Process images and try to identify views
    detected_views_map = {}
    
    for img_path in image_files:
        view = infer_view_from_filename(img_path.name)
        if view:
            detected_views_map[view] = True
            console.print(f"  - {img_path.name} [green]({view})[/green]")
        else:
            console.print(f"  - {img_path.name} [yellow](Unknown View)[/yellow]")
            
        try:
            img = Image.open(img_path)
            # Resize image for optimization
            img = resize_image(img)
            image_parts.append(img)
        except Exception as e:
            console.print(f"[bold red]Error loading image {img_path.name}:[/bold red] {e}")

    # Build context message similar to the Next.js app
    for view in EXPECTED_VIEWS:
        if view in detected_views_map:
            present_views.append(view)
        else:
            missing_views.append(view)

    context_message = f"""
      Context Injection:
      Views present: {', '.join(present_views)}
      Missing views: {', '.join(missing_views)}
    """

    console.print(Panel(f"Model: gemini-3-pro-preview\nViews Detected: {len(present_views)}\nMissing: {len(missing_views)}", title="Analysis Configuration", border_style="blue"))

    # Run Analysis
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            progress.add_task(description="Sending to Gemini...", total=None)
            
            # Construct the contents list for the new SDK
            # The new SDK handles PIL images directly in the contents list
            contents = [system_prompt, context_message] + image_parts
            
            response = client.models.generate_content(
                model="gemini-3-pro-preview",
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            console.print("\n[bold green]Analysis Complete![/bold green]")
            console.print(Panel(JSON(response.text), title="Gemini Analysis Result", border_style="green"))

    except Exception as e:
        console.print(f"\n[bold red]Analysis Failed:[/bold red] {e}")

if __name__ == "__main__":
    app()
