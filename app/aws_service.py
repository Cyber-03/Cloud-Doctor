
import boto3
from botocore.exceptions import BotoCoreError, ClientError


def get_ec2_instances():
    """Return EC2 instances in the configured AWS region."""
    try:
        ec2 = boto3.client("ec2")
        response = ec2.describe_instances()

        instances = []  

        for reservation in response.get("Reservations", []):
            for instance in reservation.get("Instances", []):
                instances.append(
                    {
                        "instance_id": instance.get("InstanceId"),
                        "state": instance.get("State", {}).get("Name"),
                        "instance_type": instance.get("InstanceType"),
                        "availability_zone": instance.get(
                            "Placement", {}
                        ).get("AvailabilityZone"),
                    }
                )
                  
        return {
            "region": ec2.meta.region_name,
            "total": len(instances),
            "instances": instances,
        }

    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError(
            "Unable to retrieve EC2 instances from AWS."
        ) from exc
