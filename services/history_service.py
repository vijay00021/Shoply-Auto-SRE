import json
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from services.database import get_db_connection

def current_iso_time() -> Tuple[str, float]:
    now = datetime.now(timezone.utc)
    iso_str = now.isoformat()
    epoch = now.timestamp()
    return iso_str, epoch

class HistoryService:
    @staticmethod
    def record_metrics_batch(metrics_snapshot: Dict[str, Dict[str, Any]], source: str = "boutique_simulator"):
        """
        Takes a snapshot of simulator metrics across services and persists them
        in a single transaction.
        metrics_snapshot format:
        {
            "paymentservice": {"latency_p95_ms": 25, "error_rate": 0.0, "requests_per_sec": 50},
            ...
        }
        """
        iso_str, epoch = current_iso_time()
        rows_to_insert = []
        
        for service, metrics in metrics_snapshot.items():
            for metric_name, value in metrics.items():
                unit = "ms" if "latency" in metric_name else "%" if "error" in metric_name else "rps" if "requests" in metric_name else ""
                status = "ok"
                if "error" in metric_name and value > 5.0:
                    status = "degraded"
                elif "latency" in metric_name and value > 200:
                    status = "degraded"

                rows_to_insert.append((
                    iso_str,
                    epoch,
                    source,
                    service,
                    metric_name,
                    float(value),
                    unit,
                    status,
                    None
                ))

        if not rows_to_insert:
            return

        with get_db_connection() as conn:
            conn.executemany("""
                INSERT INTO metrics_history (
                    timestamp, timestamp_epoch, source, service,
                    metric_name, metric_value, unit, status, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, rows_to_insert)

    @staticmethod
    def record_event(
        source: str,
        event_type: str,
        severity: str,
        service: str,
        message: str,
        status: Optional[str] = "active",
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Records an event in the historical audit log and returns its ID.
        """
        iso_str, epoch = current_iso_time()
        meta_json = json.dumps(metadata) if metadata else None
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO events_history (
                    timestamp, timestamp_epoch, source, event_type,
                    severity, service, message, status, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (iso_str, epoch, source, event_type, severity.upper(), service, message, status, meta_json))
            return cursor.lastrowid

    @staticmethod
    def query_events(
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
        service: Optional[str] = None,
        severity: Optional[str] = None,
        event_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 25
    ) -> Dict[str, Any]:
        """
        Queries historical events with multi-criteria filtering and pagination.
        """
        conditions = []
        params: List[Any] = []

        if start_time is not None:
            conditions.append("timestamp_epoch >= ?")
            params.append(start_time)
        if end_time is not None:
            conditions.append("timestamp_epoch <= ?")
            params.append(end_time)
        if service and service.lower() != "all":
            conditions.append("service = ?")
            params.append(service)
        if severity and severity.lower() != "all":
            conditions.append("severity = ?")
            params.append(severity.upper())
        if event_type and event_type.lower() != "all":
            conditions.append("event_type = ?")
            params.append(event_type)
        if status and status.lower() != "all":
            conditions.append("status = ?")
            params.append(status)
        if search:
            conditions.append("(message LIKE ? OR source LIKE ? OR service LIKE ?)")
            search_param = f"%{search}%"
            params.extend([search_param, search_param, search_param])

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        count_query = f"SELECT COUNT(*) as total FROM events_history {where_clause}"
        
        limit = max(1, min(page_size, 200))
        offset = max(0, (page - 1) * limit)

        select_query = f"""
            SELECT id, timestamp, timestamp_epoch, source, event_type,
                   severity, service, message, status, metadata
            FROM events_history
            {where_clause}
            ORDER BY timestamp_epoch DESC
            LIMIT ? OFFSET ?
        """

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(count_query, params)
            total = cursor.fetchone()["total"]

            cursor.execute(select_query, params + [limit, offset])
            rows = cursor.fetchall()

            events = []
            for row in rows:
                meta = json.loads(row["metadata"]) if row["metadata"] else None
                events.append({
                    "id": row["id"],
                    "timestamp": row["timestamp"],
                    "timestamp_epoch": row["timestamp_epoch"],
                    "source": row["source"],
                    "event_type": row["event_type"],
                    "severity": row["severity"],
                    "service": row["service"],
                    "message": row["message"],
                    "status": row["status"],
                    "metadata": meta
                })

            return {
                "events": events,
                "total": total,
                "page": page,
                "page_size": limit,
                "total_pages": (total + limit - 1) // limit if limit > 0 else 1
            }

    @staticmethod
    def query_metrics_downsampled(
        service: str,
        metric_name: str,
        time_range: str = "1h",
        custom_start: Optional[float] = None,
        custom_end: Optional[float] = None,
        target_points: int = 120
    ) -> Dict[str, Any]:
        """
        Fetches historical metrics for a service and metric, intelligently downsampling
        using time buckets so long ranges remain performant while preserving min/max spikes.
        """
        now = time.time()
        
        # Calculate time window
        range_map = {
            "15m": 15 * 60,
            "1h": 60 * 60,
            "6h": 6 * 60 * 60,
            "24h": 24 * 60 * 60,
            "7d": 7 * 24 * 60 * 60,
            "30d": 30 * 24 * 60 * 60,
        }

        if custom_start is not None and custom_end is not None:
            start_epoch = custom_start
            end_epoch = custom_end
        else:
            duration = range_map.get(time_range, 3600)
            start_epoch = now - duration
            end_epoch = now

        total_duration = max(end_epoch - start_epoch, 1)
        bucket_size = max(total_duration / target_points, 1)

        # If bucket_size is very small (< 4 seconds), we query raw points directly capped at target_points
        if bucket_size <= 4:
            query = """
                SELECT timestamp, timestamp_epoch, metric_value, status
                FROM metrics_history
                WHERE service = ? AND metric_name = ?
                  AND timestamp_epoch >= ? AND timestamp_epoch <= ?
                ORDER BY timestamp_epoch ASC
                LIMIT 500
            """
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, (service, metric_name, start_epoch, end_epoch))
                rows = cursor.fetchall()
                points = [
                    {
                        "timestamp": r["timestamp"],
                        "timestamp_epoch": r["timestamp_epoch"],
                        "value": round(r["metric_value"], 2),
                        "min": round(r["metric_value"], 2),
                        "max": round(r["metric_value"], 2),
                        "count": 1
                    }
                    for r in rows
                ]
        else:
            # Downsampled query by bucket
            query = """
                SELECT 
                    CAST(timestamp_epoch / ? AS INTEGER) * ? AS bucket_epoch,
                    datetime(MIN(timestamp_epoch), 'unixepoch') as bucket_timestamp,
                    AVG(metric_value) AS avg_val,
                    MIN(metric_value) AS min_val,
                    MAX(metric_value) AS max_val,
                    COUNT(*) AS count_val
                FROM metrics_history
                WHERE service = ? AND metric_name = ?
                  AND timestamp_epoch >= ? AND timestamp_epoch <= ?
                GROUP BY CAST(timestamp_epoch / ? AS INTEGER)
                ORDER BY bucket_epoch ASC
            """
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(query, (
                    bucket_size, bucket_size,
                    service, metric_name,
                    start_epoch, end_epoch,
                    bucket_size
                ))
                rows = cursor.fetchall()
                points = [
                    {
                        "timestamp": r["bucket_timestamp"],
                        "timestamp_epoch": r["bucket_epoch"],
                        "value": round(r["avg_val"], 2),
                        "min": round(r["min_val"], 2),
                        "max": round(r["max_val"], 2),
                        "count": r["count_val"]
                    }
                    for r in rows
                ]

        return {
            "service": service,
            "metric_name": metric_name,
            "time_range": time_range,
            "start_time": start_epoch,
            "end_time": end_epoch,
            "points": points
        }

    @staticmethod
    def get_services_and_metrics() -> Dict[str, Any]:
        """Returns distinct services and metric names present in the database."""
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT DISTINCT service FROM metrics_history ORDER BY service ASC")
            services = [r["service"] for r in cursor.fetchall()]
            
            cursor.execute("SELECT DISTINCT metric_name FROM metrics_history ORDER BY metric_name ASC")
            metrics = [r["metric_name"] for r in cursor.fetchall()]

            cursor.execute("SELECT DISTINCT event_type FROM events_history ORDER BY event_type ASC")
            event_types = [r["event_type"] for r in cursor.fetchall()]

        return {
            "services": services if services else ["frontend", "paymentservice", "checkoutservice", "cartservice"],
            "metrics": metrics if metrics else ["latency_p95_ms", "error_rate", "requests_per_sec"],
            "event_types": event_types if event_types else [
                "chaos_injected", "anomaly_detected", "log_analysis", "rca_completed",
                "remediation_started", "remediation_completed", "system_recovered",
                "alarm_state_change", "system_reset"
            ]
        }

history_service = HistoryService()
