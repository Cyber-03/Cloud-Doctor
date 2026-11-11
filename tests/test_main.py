import os
import tempfile
from pathlib import Path

from unittest.mock import patch

from fastapi.testclient import TestClient

# Create a temporary database directory for this test process.
_TEST_DB_DIR = tempfile.TemporaryDirectory(prefix="clouddoctor-tests-")

os.environ["CLOUDDOCTOR_DATABASE_PATH"] = str(
    Path(_TEST_DB_DIR.name) / "test_clouddoctor.db"
)

from app.main import app

client = TestClient(app)


def test_homepage():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["project"] == "CloudDoctor"


def test_health_check():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_dns_diagnosis():
    response = client.post(
        "/diagnose",
        json={"problem": "My domain is not resolving"}
    )

    assert response.status_code == 200
    assert response.json()["category"] == "DNS"


def test_connectivity_diagnosis():
    response = client.post(
        "/diagnose",
        json={"problem": "My server is not reachable"}
    )

    assert response.status_code == 200
    assert response.json()["category"] == "Connectivity"


def test_application_error_diagnosis():
    response = client.post(
        "/diagnose",
        json={"problem": "My server returns a 500 server error"}
    )

    assert response.status_code == 200
    assert response.json()["category"] == "Application"


def test_short_problem_is_rejected():
    response = client.post(
        "/diagnose",
        json={"problem": "ab"}
    )

    assert response.status_code == 422


def test_missing_problem_is_rejected():
    response = client.post(
        "/diagnose",
        json={}
    )

    assert response.status_code == 422


def test_long_problem_is_rejected():
    response = client.post(
        "/diagnose",
        json={"problem": "a" * 1001}
    )

    assert response.status_code == 422


def test_whitespace_is_stripped():
    response = client.post(
        "/diagnose",
        json={"problem": "  My domain is not resolving  "}
    )

    assert response.status_code == 200
    assert response.json()["reported_problem"] == (
        "My domain is not resolving"
    )
    assert response.json()["category"] == "DNS"



def test_diagnosis_creates_incident():
    response = client.post(
        "/diagnose",
        json={"problem": "My domain is not resolving"}
    )

    assert response.status_code == 200

    data = response.json()
    assert isinstance(data["incident_id"], int)
    assert data["status"] == "Open"

    incidents_response = client.get("/incidents")
    assert incidents_response.status_code == 200

    incidents_data = incidents_response.json()
    assert incidents_data["total"] >= 1
    assert any(
        item["id"] == data["incident_id"]
        for item in incidents_data["incidents"]
    )


def test_list_incidents_endpoint():
    response = client.get("/incidents")

    assert response.status_code == 200
    assert isinstance(response.json()["incidents"], list)
    assert response.json()["total"] == len(
        response.json()["incidents"]
    )
    

def test_get_incident_by_id():
    create_response = client.post(
        "/diagnose",
        json={"problem": "My domain is not resolving"}
    )

    incident_id = create_response.json()["incident_id"]

    response = client.get(f"/incidents/{incident_id}")

    assert response.status_code == 200
    assert response.json()["id"] == incident_id
    assert response.json()["status"] == "Open"


def test_resolve_incident():
    create_response = client.post(
        "/diagnose",
        json={"problem": "My server is not reachable"}
    )

    incident_id = create_response.json()["incident_id"]

    response = client.patch(
        f"/incidents/{incident_id}/resolve"
    )

    assert response.status_code == 200
    assert response.json()["status"] == "Resolved"


def test_missing_incident_returns_404():
    response = client.get("/incidents/999999")

    assert response.status_code == 404


def test_resolving_twice_returns_409():
    create_response = client.post(
        "/diagnose",
        json={"problem": "My domain is not resolving"}
    )

    incident_id = create_response.json()["incident_id"]
    url = f"/incidents/{incident_id}/resolve"

    first_response = client.patch(url)
    second_response = client.patch(url)

    assert first_response.status_code == 200
    assert second_response.status_code == 409


def test_dashboard_page():
    response = client.get("/dashboard")

    assert response.status_code == 200
    assert "CloudDoctor" in response.text
    assert 'id="diagnose-form"' in response.text


def test_dashboard_static_files():
    css_response = client.get("/static/style.css")
    js_response = client.get("/static/app.js")

    assert css_response.status_code == 200
    assert js_response.status_code == 200
    


def test_cloudwatch_status_returns_monitoring_data():
    fake_status = {
        "status": "connected",
        "region": "ap-southeast-2",
        "alarm_count": 0,
        "alarms": [],
        "ec2_cpu_metric_count": 0,
        "ec2_cpu_metrics_available": False,
    }

    with patch(
        "app.main.get_cloudwatch_status",
        return_value=fake_status,
    ):
        response = client.get("/aws/cloudwatch/status")

    assert response.status_code == 200
    assert response.json() == fake_status


def test_cloudwatch_status_returns_502_on_aws_error():
    with patch(
        "app.main.get_cloudwatch_status",
        side_effect=RuntimeError("AWS service unavailable"),
    ):
        response = client.get("/aws/cloudwatch/status")

    assert response.status_code == 502
    assert response.json() == {
        "detail": "Unable to retrieve CloudWatch monitoring data."
    }



def test_cpu_metrics_endpoint_returns_measurements():
    fake_metrics = {
        "instance_id": "i-0123456789abcdef0",
        "region": "ap-southeast-2",
        "metric_name": "CPUUtilization",
        "period_seconds": 300,
        "hours_requested": 3,
        "datapoint_count": 1,
        "datapoints": [
            {
                "timestamp": "2026-10-28T10:00:00+00:00",
                "average_cpu_percent": 24.5,
            }
        ],
        "message": "CPU metrics retrieved successfully.",
    }

    with patch(
        "app.main.get_ec2_cpu_metrics",
        return_value=fake_metrics,
    ) as mock_metrics:
        response = client.get(
            "/aws/cloudwatch/cpu/i-0123456789abcdef0"
        )

    assert response.status_code == 200
    assert response.json() == fake_metrics
    mock_metrics.assert_called_once_with(
        instance_id="i-0123456789abcdef0",
        hours=3,
    )


def test_cpu_metrics_endpoint_rejects_invalid_instance_id():
    response = client.get("/aws/cloudwatch/cpu/invalid")

    assert response.status_code == 400
    assert response.json() == {
        "detail": "A valid EC2 instance ID is required."
    }


def test_cpu_metrics_endpoint_returns_502_on_aws_error():
    with patch(
        "app.main.get_ec2_cpu_metrics",
        side_effect=RuntimeError("AWS service unavailable"),
    ):
        response = client.get(
            "/aws/cloudwatch/cpu/i-0123456789abcdef0"
        )

    assert response.status_code == 502
    assert response.json() == {
        "detail": (
            "Unable to retrieve EC2 CPU metrics from CloudWatch."
        )
    }
