import os
import subprocess
import sys

def main():
    test_assets_dir = "test-assets"
    output_file = "batch_results.txt"
    
    # Get all subdirectories in test-assets
    if not os.path.exists(test_assets_dir):
        print(f"Error: {test_assets_dir} not found.")
        return

    asset_folders = [f for f in os.listdir(test_assets_dir) if os.path.isdir(os.path.join(test_assets_dir, f))]
    asset_folders.sort()
    
    print(f"Found {len(asset_folders)} test cases: {', '.join(asset_folders)}")
    
    with open(output_file, "w") as f_out:
        for folder in asset_folders:
            folder_path = os.path.join(test_assets_dir, folder)
            cmd = ["uv", "run", "test_analysis.py", folder_path, "--times", "5"]
            
            header = f"\n{'='*20}\nRunning analysis for: {folder}\n{'='*20}\n"
            print(header)
            f_out.write(header + "\n")
            f_out.flush()
            
            try:
                # Run command and capture output
                result = subprocess.run(cmd, text=True, capture_output=True)
                
                # Print to console
                print(result.stdout)
                if result.stderr:
                    print("Errors:", result.stderr)
                
                # Write to file
                f_out.write(result.stdout)
                if result.stderr:
                    f_out.write("\nSTDERR:\n")
                    f_out.write(result.stderr)
                
                f_out.write("\n\n")
                
            except Exception as e:
                error_msg = f"Failed to run for {folder}: {e}\n"
                print(error_msg)
                f_out.write(error_msg)

    print(f"\nBatch testing complete. Results written to {output_file}")

if __name__ == "__main__":
    main()
