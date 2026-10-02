import os
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

# Default DB Path in the workspace root
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = os.environ.get("AUTOSRE_DB_PATH", str(BASE_DIR / "autosre.db"))

_lock = threading.Lock()

def get_db_path() -> str:
    return DEFAULT_DB_PATH

@contextmanager
def get_db_connection():
    """
    Context manager yielding a SQLite connection configured with WAL mode
    and standard row factory.
    """
    conn = sqlite3.connect(get_db_path(), timeout=15.0)
    conn.row_factory = sqlite3.Row
    # Enable WAL mode for high concurrent read/write throughput
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initializes the SQLite schema with required tables and indexes."""
    with _lock:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Historical Metrics Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS metrics_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                timestamp_epoch REAL NOT NULL,
                source TEXT NOT NULL,
                service TEXT NOT NULL,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                unit TEXT,
                status TEXT,
                metadata TEXT
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_metrics_svc_metric_time ON metrics_history(service, metric_name, timestamp_epoch);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_metrics_time ON metrics_history(timestamp_epoch);")

            # 2. Historical Events Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS events_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                timestamp_epoch REAL NOT NULL,
                source TEXT NOT NULL,
                event_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                service TEXT NOT NULL,
                message TEXT NOT NULL,
                status TEXT,
                metadata TEXT
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_time ON events_history(timestamp_epoch);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_svc ON events_history(service);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_sev ON events_history(severity);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_type ON events_history(event_type);")

            # 3. Alarm Rules Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS alarm_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                metric TEXT NOT NULL,
                target_service TEXT NOT NULL,
                operator TEXT NOT NULL,
                threshold REAL NOT NULL,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                severity TEXT NOT NULL DEFAULT 'WARNING',
                enabled INTEGER NOT NULL DEFAULT 1,
                cooldown_seconds INTEGER NOT NULL DEFAULT 60,
                recovery_threshold REAL,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """)

            # 4. Alarms Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS alarms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT NOT NULL,
                service TEXT NOT NULL,
                metric TEXT NOT NULL,
                severity TEXT NOT NULL,
                state TEXT NOT NULL,
                started_at TEXT NOT NULL,
                started_at_epoch REAL NOT NULL,
                trigger_value REAL,
                current_value REAL,
                acknowledged_at TEXT,
                acknowledged_by TEXT,
                resolved_at TEXT,
                resolved_at_epoch REAL,
                resolution_reason TEXT,
                last_evaluated_at TEXT,
                metadata TEXT
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_alarms_state ON alarms(state);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_alarms_rule_svc ON alarms(rule_id, service);")

            # 5. Alarm State Transitions Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS alarm_transitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                alarm_id INTEGER NOT NULL,
                from_state TEXT NOT NULL,
                to_state TEXT NOT NULL,
                reason TEXT,
                value REAL,
                timestamp TEXT NOT NULL,
                timestamp_epoch REAL NOT NULL
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_transitions_alarm ON alarm_transitions(alarm_id);")

            # 6. Policy / Guardrails Table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS policies (
                id TEXT PRIMARY KEY,
                action_type TEXT UNIQUE NOT NULL,
                risk_level TEXT NOT NULL,
                auto_allowed INTEGER NOT NULL DEFAULT 1,
                notify_required INTEGER NOT NULL DEFAULT 0,
                approval_required INTEGER NOT NULL DEFAULT 0,
                max_limit REAL,
                enabled INTEGER NOT NULL DEFAULT 1,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            """)

            # 7. Incident Records Table (Autonomous Agent Audit Trail)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS incident_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT UNIQUE NOT NULL,
                alarm_id INTEGER,
                service TEXT NOT NULL,
                anomaly_condition TEXT,
                diagnosis TEXT,
                proposed_action TEXT,
                action_type TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                policy_result TEXT NOT NULL,
                execution_mode TEXT NOT NULL,
                execution_result TEXT,
                verification_result TEXT,
                status TEXT NOT NULL,
                trigger_value REAL,
                current_value REAL,
                detected_at TEXT NOT NULL,
                detected_at_epoch REAL NOT NULL,
                resolved_at TEXT,
                resolved_at_epoch REAL,
                metadata TEXT
            );
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_incidents_status ON incident_records(status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_incidents_svc ON incident_records(service);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_incidents_time ON incident_records(detected_at_epoch);")

            conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database schema successfully initialized.")
