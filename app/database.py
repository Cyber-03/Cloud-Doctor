
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
import os


# Store the database in the main CloudDoctor project folder.
# Use a test database when configured; otherwise use the production database.
BASE_DIR = Path(__file__).resolve().parent.parent

DATABASE_PATH = Path(
    os.environ.get(
        "CLOUDDOCTOR_DATABASE_PATH",
        str(BASE_DIR / "clouddoctor.db")
    )
)

def get_connection():
    """Create and return a connection to the SQLite database."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_db():
    """Create the incidents table if it does not exist."""
    connection = get_connection()

    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                problem TEXT NOT NULL,
                category TEXT NOT NULL,
                possible_cause TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Open',
                created_at TEXT NOT NULL
            )
            """
        )

        connection.commit()

    finally:
        connection.close()


def create_incident(problem, category, possible_cause):
    """Save a new incident and return its database ID."""
    created_at = datetime.now(timezone.utc).isoformat()

    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            INSERT INTO incidents (
                problem,
                category,
                possible_cause,
                status,
                created_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                problem,
                category,
                possible_cause,
                "Open",
                created_at,
            ),
        )

        connection.commit()
        return cursor.lastrowid

    finally:
        connection.close()


def get_incidents():
    """Return all incidents, newest first."""
    connection = get_connection()

    try:
        rows = connection.execute(
            """
            SELECT id, problem, category, possible_cause,
                   status, created_at
            FROM incidents
            ORDER BY id DESC
            """
        ).fetchall()

        return [dict(row) for row in rows]

    finally:
        connection.close()



def get_incident_by_id(incident_id):
    """Return one incident by ID, or None if it does not exist."""
    connection = get_connection()

    try:
        row = connection.execute(
            """
            SELECT id, problem, category, possible_cause,
                   status, created_at
            FROM incidents
            WHERE id = ?
            """,
            (incident_id,),
        ).fetchone()

        return dict(row) if row is not None else None

    finally:
        connection.close()


def resolve_incident(incident_id):
    """Mark an open incident as resolved."""
    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            UPDATE incidents
            SET status = 'Resolved'
            WHERE id = ? AND status = 'Open'
            """,
            (incident_id,),
        )

        connection.commit()
        return cursor.rowcount > 0

    finally:
        connection.close()
