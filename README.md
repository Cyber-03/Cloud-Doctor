# CloudDoctor – Cloud Troubleshooting Assistant

![Python](https://img.shields.io/badge/Python-3.x-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![SQLite](https://img.shields.io/badge/Database-SQLite-blue)
![AWS](https://img.shields.io/badge/Cloud-AWS-orange)
![Status](https://img.shields.io/badge/Project-In%20Development-yellow)

## Overview

CloudDoctor is a Python-based cloud troubleshooting assistant designed to simplify infrastructure incident management through a centralized web dashboard.

The application helps users create, diagnose, search, track, and resolve infrastructure incidents. It is being developed with the goal of integrating AWS services such as EC2 and CloudWatch for cloud resource monitoring and troubleshooting.

## Problem Statement

Managing infrastructure incidents can become difficult when information is scattered across different tools. Engineers need a centralized way to track incidents, understand reported issues, and monitor their resolution.

CloudDoctor aims to provide a simple platform for managing these activities.

## Key Features

- **Incident Dashboard:** View incident statistics and manage reported incidents.
- **Incident Creation:** Create new infrastructure incidents.
- **Incident Diagnosis:** Process reported incidents through the application's diagnosis workflow.
- **Incident Search:** Search for incidents using their IDs.
- **Incident Resolution:** Update incidents when issues are resolved.
- **Database Integration:** Store incident information using SQLite.
- **AWS Integration:** Initial service modules for EC2 and CloudWatch integration.

## Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend programming |
| FastAPI | Web framework and API development |
| SQLite | Database |
| HTML | Dashboard structure |
| CSS | Dashboard styling |
| JavaScript | Frontend interactions |
| Boto3 | AWS SDK for Python |
| Pytest | Automated testing |

## Architecture

The current application follows this general workflow:

```text
        User
         |
         v
   Web Dashboard
         |
         v
    FastAPI Backend
         |
         v
 Incident Management
         |
         v
    SQLite Database
```

AWS EC2 and CloudWatch integration modules are included as part of the ongoing development of the project.

## Project Structure

```text
CloudDoctor/
|
|-- app/
|   |-- __init__.py
|   |-- main.py
|   |-- database.py
|   |-- aws_service.py
|   |-- cloudwatch_metrics_service.py
|   |-- cloudwatch_service.py
|   |
|   |-- static/
|       |-- app.js
|       |-- index.html
|       |-- style.css
|
|-- tests/
|   |-- test_main.py
|
|-- .gitignore
|-- README.md
|-- requirements.txt
```

## Installation and Setup

### Prerequisites

- Python 3
- Git
- Visual Studio Code (recommended)

### 1. Clone the repository

```bash
git clone https://github.com/Cyber-03/Cloud-Doctor.git
```

### 2. Navigate into the project

```bash
cd Cloud-Doctor
```

### 3. Create a virtual environment

Windows PowerShell:

```powershell
python -m venv venv
```

### 4. Activate the virtual environment

```powershell
.\venv\Scripts\Activate.ps1
```

### 5. Install dependencies

```bash
pip install -r requirements.txt
```

### 6. Start the application

```bash
uvicorn app.main:app --reload
```

### 7. Open the application

Visit:

```text
http://127.0.0.1:8000
```

## Testing

The project includes automated tests using Pytest.

Run:

```bash
pytest -v
```

## Current Development Status

**Phase 1 – Core Application**

- FastAPI application foundation.
- Incident management dashboard.
- Incident creation and diagnosis workflow.
- Incident search and resolution.
- SQLite database integration.

**Ongoing Development**

- AWS EC2 monitoring integration.
- CloudWatch metrics integration.
- Improved automated troubleshooting.
- Advanced cloud infrastructure monitoring.

## Future Enhancements

- Automated AWS infrastructure health checks.
- Real-time CloudWatch metrics visualization.
- Docker containerization.
- CI/CD pipeline integration.
- Kubernetes monitoring.
- Improved incident diagnosis and reporting.

## Learning Outcomes

Through CloudDoctor, the project explores:

- Python backend development.
- REST API development using FastAPI.
- Database integration.
- Incident management workflows.
- AWS cloud service integration.
- Software testing using Pytest.
- Git and GitHub version control.

## Disclaimer

CloudDoctor is an educational and development project. Some AWS integration and advanced monitoring capabilities are still under development. Features should be considered implemented only where they are currently functional.

## Author

**Cyber-03**

GitHub: https://github.com/Cyber-03

---

If you find this project interesting, feel free to explore the repository and follow its development.