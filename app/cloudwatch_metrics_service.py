
import boto3
from datetime import datetime, timedelta, timezone
from botocore.exceptions import BotoCoreError, ClientError


def get_ec2_cpu_metrics(instance_id, hours=3):
    """
    Retrieve recent EC2 CPU utilization measurements
    from CloudWatch for one EC2 instance.
    """

    if not instance_id or not instance_id.startswith("i-"):
        raise ValueError("A valid EC2 instance ID is required.")

    if not isinstance(hours, int) or not 1 <= hours <= 24:
        raise ValueError("Hours must be an integer between 1 and 24.")

    try:
        cloudwatch = boto3.client("cloudwatch")

        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)

        response = cloudwatch.get_metric_statistics(
            Namespace="AWS/EC2",
            MetricName="CPUUtilization",
            Dimensions=[
                {
                    "Name": "InstanceId",
                    "Value": instance_id,
                }
            ],
            StartTime=start_time,
            EndTime=end_time,
            Period=300,
            Statistics=["Average"],
        )

        datapoints = sorted(
            response.get("Datapoints", []),
            key=lambda point: point["Timestamp"],
        )

        measurements = [
            {
                "timestamp": point["Timestamp"].isoformat(),
                "average_cpu_percent": round(point["Average"], 2),
            }
            for point in datapoints
        ]

        return {
            "instance_id": instance_id,
            "region": cloudwatch.meta.region_name,
            "metric_name": "CPUUtilization",
            "period_seconds": 300,
            "hours_requested": hours,
            "datapoint_count": len(measurements),
            "datapoints": measurements,
            "message": (
                "CPU metrics retrieved successfully."
                if measurements
                else "No CPU datapoints found for this instance and time range."
            ),
        }

    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(
            "Unable to retrieve EC2 CPU metrics from CloudWatch."
        ) from exc
