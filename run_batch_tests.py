# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "rich",
# ]
# ///

import os
import subprocess
import sys
import json
from rich.console import Console
from rich.table import Table

def main():
    test_assets_dir = "test-assets"
    output_file = "batch_results.txt"
    
    # Use two consoles: one for stdout/screen, one for capturing file output
    console = Console()
    file_console = Console(file=open(output_file, "w"), width=120)

    # Get all subdirectories in test-assets
    if not os.path.exists(test_assets_dir):
        console.print(f"[bold red]Error:[/bold red] {test_assets_dir} not found.")
        return

    asset_folders = [f for f in os.listdir(test_assets_dir) if os.path.isdir(os.path.join(test_assets_dir, f))]
    asset_folders.sort()
    
    console.print(f"[bold blue]Found {len(asset_folders)} test cases: {', '.join(asset_folders)}[/bold blue]\n")
    
    # Header for file
    file_console.print("Batch Analysis Results Summary", style="bold underline")
    file_console.print("")

    for folder in asset_folders:
        folder_path = os.path.join(test_assets_dir, folder)
        
        console.print(f"\n[bold]Running analysis for: {folder}[/bold]")
        
        # Run with --json-mode
        # This sends LOGS to stderr (which we print to console)
        # And JSON DATA to stdout (which we parse for the table)
        cmd = ["uv", "run", "test_analysis.py", folder_path, "--times", "5", "--json-mode"]
        
        try:
            result = subprocess.run(cmd, text=True, capture_output=True)
            
            # Print logs to console (User wants "output of terminal as it was")
            if result.stderr:
                console.print(result.stderr, end="")
            
            if result.returncode != 0:
                console.print(f"[red]Analysis failed for {folder}[/red]")
                continue

            # Parse JSON to build table
            try:
                data = json.loads(result.stdout)
                
                # Create table for this folder
                table = Table(title=f"Results: {folder}")
                table.add_column("Run", justify="right", style="cyan", no_wrap=True)
                table.add_column("Outsole Score", style="magenta")
                table.add_column("Midsole Life %", style="green")
                table.add_column("Est. Km Left", style="yellow")

                for entry in data:
                    table.add_row(
                        str(entry.get("run", "?")),
                        str(entry.get("outsole_score", "N/A")),
                        str(entry.get("midsole_life", "N/A")),
                        str(entry.get("km_left", "N/A"))
                    )
                
                # Print Table to Console
                console.print(table)
                
                # Write ONLY Table to File
                file_console.print(table)
                file_console.print("") # spacing
                
            except json.JSONDecodeError:
                console.print(f"[red]Invalid JSON output from script[/red]")

        except Exception as e:
            console.print(f"[red]Error executing script: {e}[/red]")

    console.print(f"\n[bold green]Batch processing complete.[/bold green] Summary written to {output_file}")

if __name__ == "__main__":
    main()
