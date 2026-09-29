from fastapi import APIRouter, BackgroundTasks
import subprocess
import os

router = APIRouter()

# Global state to track pipeline status (simple for hackathon)
pipeline_status = {
    "status": "idle", # idle, running, completed, error
    "logs": [],
    "progress": 0
}

def run_ml_pipeline():
    global pipeline_status
    pipeline_status["status"] = "running"
    pipeline_status["logs"] = ["Starting ML Pipeline..."]
    pipeline_status["progress"] = 10
    
    try:
        # Run the ingestion
        pipeline_status["logs"].append("Running data ingestion from IMD GFS and CHIRPS...")
        pipeline_status["progress"] = 30
        
        # In a real app we'd stream stdout, but here we'll just run the script
        # The script is ml_pipeline.py at the root
        process = subprocess.Popen(
            [".venv/bin/python", "ml_pipeline.py"],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
        )
        
        pipeline_status["progress"] = 50
        for line in process.stdout:
            if line.strip():
                pipeline_status["logs"].append(line.strip())
                # Fake progress increments based on log output
                if "Extracting spatial features" in line:
                    pipeline_status["progress"] = 60
                elif "Starting parallel inference" in line:
                    pipeline_status["progress"] = 75
                elif "Saved predictions" in line:
                    pipeline_status["progress"] = 90
        
        process.wait()
        
        if process.returncode == 0:
            # Also run push_to_turso.py to update DB
            pipeline_status["logs"].append("Pushing predictions to Turso Database...")
            subprocess.run([".venv/bin/python", "scripts/push_to_turso.py"], 
                          cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
            pipeline_status["progress"] = 100
            pipeline_status["status"] = "completed"
            pipeline_status["logs"].append("Pipeline completed successfully!")
        else:
            pipeline_status["status"] = "error"
            pipeline_status["logs"].append(f"Pipeline failed with code {process.returncode}")
            
    except Exception as e:
        pipeline_status["status"] = "error"
        pipeline_status["logs"].append(f"Error: {str(e)}")

@router.post("/run")
def trigger_pipeline(background_tasks: BackgroundTasks):
    global pipeline_status
    if pipeline_status["status"] == "running":
        return {"message": "Pipeline is already running"}
    
    background_tasks.add_task(run_ml_pipeline)
    return {"message": "Pipeline started"}

@router.get("/status")
def get_pipeline_status():
    global pipeline_status
    return pipeline_status

@router.post("/reset")
def reset_pipeline():
    global pipeline_status
    pipeline_status = {
        "status": "idle",
        "logs": [],
        "progress": 0
    }
    return {"message": "Pipeline reset"}
