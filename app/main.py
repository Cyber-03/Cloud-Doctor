from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel, Field, ConfigDict
from app.aws_service import get_ec2_instances
from app.cloudwatch_service import get_cloudwatch_status
from app.cloudwatch_metrics_service import get_ec2_cpu_metrics

from app.database import (
    initialize_db,
    create_incident,
    get_incidents,
    get_incident_by_id,
    resolve_incident,
)
from fastapi import FastAPI, HTTPException

app = FastAPI(
    title="CloudDoctor",
    description="A cloud troubleshooting assistant",
    version="0.4.0" 
)

STATIC_DIR = Path(__file__).resolve().parent / "static"

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static"
)

# Ensure the database table exists when the application starts.
initialize_db()


class Incident(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    problem: str = Field(
        min_length=3,
        max_length=1000,
        description="Describe the technical problem"
    )


@app.get("/")
def home():
    return {
        "project": "CloudDoctor",
        "message": "CloudDoctor is running successfully!"
    }
   
@app.get("/dashboard", include_in_schema=False)
def dashboard():
    return FileResponse(STATIC_DIR / "index.html")    


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "CloudDoctor API"
    }
    

@app.get("/aws/ec2/instances")
def list_aws_ec2_instances():
    try:
        return get_ec2_instances()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve EC2 instances from AWS."
        ) from exc



@app.get("/aws/cloudwatch/status")
def cloudwatch_status():
    try:
        return get_cloudwatch_status()
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve CloudWatch monitoring data."
        ) from exc


@app.get("/aws/cloudwatch/cpu/{instance_id}")
def get_instance_cpu_metrics(instance_id: str, hours: int = 3):
    try:
        return get_ec2_cpu_metrics(
            instance_id=instance_id,
            hours=hours,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve EC2 CPU metrics from CloudWatch.",
        ) from exc



@app.post("/diagnose")
def diagnose(incident: Incident):
    problem = incident.problem.lower()

    if "dns" in problem or "domain" in problem:
        category = "DNS"
        cause = "Possible DNS resolution failure"
        steps = [
            "Check the domain name for typing errors.",
            "Run nslookup on the domain.",
            "Verify DNS server settings and DNS records."
        ]
        commands = ["nslookup example.com"]

    elif "timeout" in problem or "not reachable" in problem:
        category = "Connectivity"
        cause = "Possible network connectivity issue"
        steps = [
            "Check whether the destination service is running.",
            "Test the destination TCP port.",
            "Review firewall and security group rules.",
            "Check route tables and network connectivity."
        ]
        commands = [
            "Test-NetConnection example.com -Port 443"
        ]

    elif "500" in problem or "server error" in problem:
        category = "Application"
        cause = "Possible application-side failure"
        steps = [
            "Inspect application logs for errors.",
            "Check whether the application process is running.",
            "Review recent deployments and configuration changes.",
            "Check database and service dependencies."
        ]
        commands = []

    else:
        category = "General Support"
        cause = "The root cause needs further investigation"
        steps = [
            "Record the exact error message.",
            "Identify when the problem started.",
            "Check service health and recent logs.",
            "Reproduce the problem and narrow down its scope."
        ]
        commands = []

    # Save the diagnosis as a new incident.
    incident_id = create_incident(
        problem=incident.problem,
        category=category,
        possible_cause=cause
    )

    return {
        "incident_id": incident_id,
        "status": "Open",
        "reported_problem": incident.problem,
        "category": category,
        "possible_cause": cause,
        "troubleshooting_steps": steps,
        "suggested_commands": commands,
        "note": "This is a preliminary diagnosis, not a confirmed root cause."
    }


@app.get("/incidents")
def list_incidents():
    return {
        "total": len(get_incidents()),
        "incidents": get_incidents()
    }



@app.get("/incidents/{incident_id}")
def get_incident(incident_id: int):
    incident = get_incident_by_id(incident_id)

    if incident is None:
        raise HTTPException(
            status_code=404,
            detail="Incident not found"
        )

    return incident


@app.patch("/incidents/{incident_id}/resolve")
def mark_incident_resolved(incident_id: int):
    updated = resolve_incident(incident_id)

    if not updated:
        incident = get_incident_by_id(incident_id)

        if incident is None:
            raise HTTPException(
                status_code=404,
                detail="Incident not found"
            )

        raise HTTPException(
            status_code=409,
            detail="Incident is already resolved"
        )

    return get_incident_by_id(incident_id)
