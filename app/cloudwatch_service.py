
import boto3
from botocore.exceptions import BotoCoreError, ClientError


def get_cloudwatch_status():
    """Return CloudWatch alarms and available EC2 CPU metrics."""

    try:
        cloudwatch = boto3.client("cloudwatch")

        # Retrieve CloudWatch alarms without creating or modifying them.
        alarm_response = cloudwatch.describe_alarms(
            MaxRecords=100
        )

        metric_response = cloudwatch.list_metrics(
            Namespace="AWS/EC2",
            MetricName="CPUUtilization",
        )

        metric_count = len(metric_response.get("Metrics", []))

        metric_alarms = alarm_response.get("MetricAlarms", [])
        composite_alarms = alarm_response.get("CompositeAlarms", [])

        alarms = []

        for alarm in metric_alarms:
            alarms.append({
                "name": alarm.get("AlarmName"),
                "state": alarm.get("StateValue"),
                "reason": alarm.get("StateReason", ""),
            })

        for alarm in composite_alarms:
            alarms.append({
                "name": alarm.get("AlarmName"),
                "state": alarm.get("StateValue"),
                "reason": alarm.get("StateReason", ""),
            })

        return {
            "status": "connected",
            "region": cloudwatch.meta.region_name,
            "alarm_count": len(alarms),
            "alarms": alarms,
            "ec2_cpu_metric_count": metric_count,
            "ec2_cpu_metrics_available": metric_count > 0,
        }

    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(
            "Unable to retrieve CloudWatch monitoring data."
        ) from exc
