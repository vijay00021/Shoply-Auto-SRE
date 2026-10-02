import json
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from services.database import get_db_connection, init_db
from services.history_service import history_service, current_iso_time

OPERATORS = {
    ">": lambda a, b: a > b,
    ">=": lambda a, b: a >= b,
    "<": lambda a, b: a < b,
    "<=": lambda a, b: a <= b,
    "==": lambda a, b: abs(a - b) < 1e-6,
    "!=": lambda a, b: abs(a - b) >= 1e-6,
}

DEFAULT_RULES = [
    {
        "id": "rule_payment_latency",
        "name": "Payment Service High Latency",
        "metric": "latency_p95_ms",
        "target_service": "paymentservice",
        "operator": ">",
        "threshold": 1000.0,
        "duration_seconds": 4,
        "severity": "CRITICAL",
        "enabled": 1,
        "cooldown_seconds": 30,
        "recovery_threshold": 300.0,
        "description": "Fires when Payment Service p95 latency exceeds 1000ms for more than 4 seconds."
    },
    {
        "id": "rule_payment_error",
        "name": "Payment Service High Error Rate",
        "metric": "error_rate",
        "target_service": "paymentservice",
        "operator": ">",
        "threshold": 20.0,
        "duration_seconds": 4,
        "severity": "CRITICAL",
        "enabled": 1,
        "cooldown_seconds": 30,
        "recovery_threshold": 2.0,
        "description": "Fires when Payment Service error rate exceeds 20% for more than 4 seconds."
    },
    {
        "id": "rule_checkout_error",
        "name": "Checkout Service High Error Rate",
        "metric": "error_rate",
        "target_service": "checkoutservice",
        "operator": ">",
        "threshold": 15.0,
        "duration_seconds": 4,
        "severity": "ERROR",
        "enabled": 1,
        "cooldown_seconds": 30,
        "recovery_threshold": 2.0,
        "description": "Fires when Checkout Service error rate exceeds 15% for more than 4 seconds."
    },
    {
        "id": "rule_frontend_latency",
        "name": "Frontend High Latency",
        "metric": "latency_p95_ms",
        "target_service": "frontend",
        "operator": ">",
        "threshold": 400.0,
        "duration_seconds": 4,
        "severity": "WARNING",
        "enabled": 1,
        "cooldown_seconds": 30,
        "recovery_threshold": 100.0,
        "description": "Fires when Frontend response latency exceeds 400ms for more than 4 seconds."
    },
    {
        "id": "rule_frontend_traffic",
        "name": "Frontend Traffic Surge",
        "metric": "requests_per_sec",
        "target_service": "frontend",
        "operator": ">",
        "threshold": 1500.0,
        "duration_seconds": 4,
        "severity": "WARNING",
        "enabled": 1,
        "cooldown_seconds": 30,
        "recovery_threshold": 500.0,
        "description": "Fires when Frontend traffic spikes over 1500 RPS for more than 4 seconds."
    }
]

class AlarmEngine:
    def __init__(self):
        # Maps (rule_id, service) -> condition_start_epoch (for sustained condition evaluation)
        self._pending_conditions: Dict[Tuple[str, str], float] = {}
        # Maps (rule_id, service) -> last_resolved_epoch (for cooldown check)
        self._last_resolved: Dict[Tuple[str, str], float] = {}
        self.init_rules()

    def init_rules(self):
        """Seeds default rules into the database if not present."""
        init_db()
        now_str, _ = current_iso_time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            for r in DEFAULT_RULES:
                cursor.execute("SELECT id FROM alarm_rules WHERE id = ?", (r["id"],))
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO alarm_rules (
                            id, name, metric, target_service, operator, threshold,
                            duration_seconds, severity, enabled, cooldown_seconds,
                            recovery_threshold, description, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        r["id"], r["name"], r["metric"], r["target_service"],
                        r["operator"], r["threshold"], r["duration_seconds"],
                        r["severity"], r["enabled"], r["cooldown_seconds"],
                        r["recovery_threshold"], r["description"],
                        now_str, now_str
                    ))

    def get_rules(self) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alarm_rules ORDER BY created_at ASC")
            return [dict(row) for row in cursor.fetchall()]

    def get_rule_by_id(self, rule_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alarm_rules WHERE id = ?", (rule_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_rule(self, rule_data: Dict[str, Any]) -> Dict[str, Any]:
        now_str, _ = current_iso_time()
        rule_id = rule_data.get("id") or f"rule_{int(time.time()*1000)}"
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO alarm_rules (
                    id, name, metric, target_service, operator, threshold,
                    duration_seconds, severity, enabled, cooldown_seconds,
                    recovery_threshold, description, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rule_id,
                rule_data["name"],
                rule_data["metric"],
                rule_data["target_service"],
                rule_data["operator"],
                float(rule_data["threshold"]),
                int(rule_data.get("duration_seconds", 0)),
                rule_data.get("severity", "WARNING").upper(),
                1 if rule_data.get("enabled", True) else 0,
                int(rule_data.get("cooldown_seconds", 60)),
                float(rule_data["recovery_threshold"]) if rule_data.get("recovery_threshold") is not None else None,
                rule_data.get("description", ""),
                now_str,
                now_str
            ))
            return self.get_rule_by_id(rule_id)

    def update_rule(self, rule_id: str, rule_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now_str, _ = current_iso_time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE alarm_rules SET
                    name = ?, metric = ?, target_service = ?, operator = ?,
                    threshold = ?, duration_seconds = ?, severity = ?,
                    enabled = ?, cooldown_seconds = ?, recovery_threshold = ?,
                    description = ?, updated_at = ?
                WHERE id = ?
            """, (
                rule_data["name"],
                rule_data["metric"],
                rule_data["target_service"],
                rule_data["operator"],
                float(rule_data["threshold"]),
                int(rule_data.get("duration_seconds", 0)),
                rule_data.get("severity", "WARNING").upper(),
                1 if rule_data.get("enabled", True) else 0,
                int(rule_data.get("cooldown_seconds", 60)),
                float(rule_data["recovery_threshold"]) if rule_data.get("recovery_threshold") is not None else None,
                rule_data.get("description", ""),
                now_str,
                rule_id
            ))
            return self.get_rule_by_id(rule_id)

    def toggle_rule(self, rule_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT enabled FROM alarm_rules WHERE id = ?", (rule_id,))
            row = cursor.fetchone()
            if not row:
                return None
            new_state = 0 if row["enabled"] else 1
            cursor.execute("UPDATE alarm_rules SET enabled = ?, updated_at = ? WHERE id = ?", 
                           (new_state, current_iso_time()[0], rule_id))
            
            if new_state == 0:
                keys_to_clear = [k for k in self._pending_conditions if k[0] == rule_id]
                for k in keys_to_clear:
                    self._pending_conditions.pop(k, None)

            return self.get_rule_by_id(rule_id)

    def delete_rule(self, rule_id: str) -> bool:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM alarm_rules WHERE id = ?", (rule_id,))
            return cursor.rowcount > 0

    def evaluate(self, metrics_snapshot: Dict[str, Dict[str, Any]]):
        """
        Evaluates active alarm rules against current metric values.
        Executed synchronously or asynchronously alongside simulator ticks.
        """
        now_iso, now_epoch = current_iso_time()
        rules = self.get_rules()

        for rule in rules:
            if not rule["enabled"]:
                keys_to_clear = [k for k in self._pending_conditions if k[0] == rule["id"]]
                for k in keys_to_clear:
                    self._pending_conditions.pop(k, None)
                continue

            target_svc = rule["target_service"]
            metric_name = rule["metric"]
            op_fn = OPERATORS.get(rule["operator"])
            if not op_fn:
                continue

            # Determine which services to evaluate
            services_to_eval = (
                [target_svc] if target_svc != "*" 
                else list(metrics_snapshot.keys())
            )

            for svc in services_to_eval:
                svc_metrics = metrics_snapshot.get(svc)
                if not svc_metrics or metric_name not in svc_metrics:
                    continue

                curr_val = float(svc_metrics[metric_name])
                threshold = float(rule["threshold"])
                recovery_threshold = (
                    float(rule["recovery_threshold"]) 
                    if rule["recovery_threshold"] is not None 
                    else threshold
                )

                cond_key = (rule["id"], svc)
                is_condition_true = op_fn(curr_val, threshold)

                # Check active alarm in DB
                active_alarm = self._get_active_alarm(rule["id"], svc)

                if is_condition_true:
                    # Condition is currently breached
                    if cond_key not in self._pending_conditions:
                        self._pending_conditions[cond_key] = now_epoch
                    
                    elapsed = now_epoch - self._pending_conditions[cond_key]

                    if not active_alarm:
                        # Check cooldown
                        last_resolved_epoch = self._last_resolved.get(cond_key, 0)
                        if now_epoch - last_resolved_epoch < rule["cooldown_seconds"]:
                            # In cooldown period, do not re-fire yet
                            continue

                        # Check duration requirement (sustained condition)
                        if elapsed >= rule["duration_seconds"]:
                            # Condition has been sustained! Fire alarm!
                            self._create_alarm(
                                rule=rule,
                                service=svc,
                                trigger_value=curr_val,
                                started_at_iso=now_iso,
                                started_at_epoch=now_epoch
                            )
                    else:
                        # Active alarm already exists (Deduplication!)
                        # Update current value without spawning duplicates
                        self._update_alarm_metric(active_alarm["id"], curr_val, now_iso)
                else:
                    # Condition is NOT breached (or recovery condition met)
                    self._pending_conditions.pop(cond_key, None)

                    if active_alarm:
                        # Only auto-resolve if alarm is in normal automatic lifecycle (FIRING, ACKNOWLEDGED)
                        # Do NOT auto-resolve if in human approval or verification failed/escalated state
                        if active_alarm["state"] in ['FIRING', 'ACKNOWLEDGED']:
                            is_recovered = False
                            if rule["operator"] in [">", ">="]:
                                is_recovered = (curr_val <= recovery_threshold)
                            elif rule["operator"] in ["<", "<="]:
                                is_recovered = (curr_val >= recovery_threshold)
                            else:
                                is_recovered = not is_condition_true

                            if is_recovered:
                                # Trigger automated recovery
                                self._resolve_alarm(
                                    alarm_id=active_alarm["id"],
                                    reason=f"Metric returned to normal ({curr_val} {rule['metric']})",
                                    resolved_at_iso=now_iso,
                                    resolved_at_epoch=now_epoch,
                                    current_value=curr_val
                                )
                                self._last_resolved[cond_key] = now_epoch

    def _get_active_alarm(self, rule_id: str, service: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM alarms 
                WHERE rule_id = ? AND service = ? 
                  AND state != 'RESOLVED'
                ORDER BY id DESC LIMIT 1
            """, (rule_id, service))
            row = cursor.fetchone()
            return dict(row) if row else None

    def _create_alarm(
        self,
        rule: Dict[str, Any],
        service: str,
        trigger_value: float,
        started_at_iso: str,
        started_at_epoch: float
    ) -> int:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO alarms (
                    rule_id, service, metric, severity, state,
                    started_at, started_at_epoch, trigger_value, current_value,
                    last_evaluated_at
                ) VALUES (?, ?, ?, ?, 'FIRING', ?, ?, ?, ?, ?)
            """, (
                rule["id"], service, rule["metric"], rule["severity"],
                started_at_iso, started_at_epoch, trigger_value, trigger_value,
                started_at_iso
            ))
            alarm_id = cursor.lastrowid

            # Record transition NORMAL -> FIRING
            cursor.execute("""
                INSERT INTO alarm_transitions (
                    alarm_id, from_state, to_state, reason, value,
                    timestamp, timestamp_epoch
                ) VALUES (?, 'NORMAL', 'FIRING', ?, ?, ?, ?)
            """, (
                alarm_id,
                f"Sustained threshold breach: {trigger_value} {rule['operator']} {rule['threshold']}",
                trigger_value, started_at_iso, started_at_epoch
            ))

        # Record event in event audit log
        history_service.record_event(
            source="AlarmEngine",
            event_type="alarm_state_change",
            severity=rule["severity"],
            service=service,
            message=f"Alarm [{rule['name']}] fired on {service}: {rule['metric']} = {trigger_value}",
            status="firing",
            metadata={"alarm_id": alarm_id, "rule_id": rule["id"], "value": trigger_value}
        )

        return alarm_id

    def _update_alarm_metric(self, alarm_id: int, current_value: float, now_iso: str):
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE alarms 
                SET current_value = ?, last_evaluated_at = ? 
                WHERE id = ?
            """, (current_value, now_iso, alarm_id))

    def acknowledge_alarm(self, alarm_id: int, acknowledged_by: str = "operator", note: str = "") -> bool:
        now_iso, now_epoch = current_iso_time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alarms WHERE id = ?", (alarm_id,))
            alarm = cursor.fetchone()
            if not alarm or alarm["state"] != "FIRING":
                return False

            cursor.execute("""
                UPDATE alarms SET
                    state = 'ACKNOWLEDGED',
                    acknowledged_at = ?,
                    acknowledged_by = ?
                WHERE id = ?
            """, (now_iso, acknowledged_by, alarm_id))

            cursor.execute("""
                INSERT INTO alarm_transitions (
                    alarm_id, from_state, to_state, reason, value,
                    timestamp, timestamp_epoch
                ) VALUES (?, 'FIRING', 'ACKNOWLEDGED', ?, ?, ?, ?)
            """, (alarm_id, note or f"Acknowledged by {acknowledged_by}", alarm["current_value"], now_iso, now_epoch))

        history_service.record_event(
            source="AlarmEngine",
            event_type="alarm_acknowledged",
            severity="INFO",
            service=alarm["service"],
            message=f"Alarm #{alarm_id} acknowledged by {acknowledged_by}",
            status="acknowledged",
            metadata={"alarm_id": alarm_id, "acknowledged_by": acknowledged_by, "note": note}
        )
        return True

    def resolve_alarm_manually(self, alarm_id: int, reason: str = "Resolved by user") -> bool:
        now_iso, now_epoch = current_iso_time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alarms WHERE id = ?", (alarm_id,))
            alarm = cursor.fetchone()
            if not alarm or alarm["state"] == "RESOLVED":
                return False

            self._resolve_alarm(alarm_id, reason, now_iso, now_epoch, alarm["current_value"])
            return True

    def _resolve_alarm(
        self,
        alarm_id: int,
        reason: str,
        resolved_at_iso: str,
        resolved_at_epoch: float,
        current_value: Optional[float]
    ):
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alarms WHERE id = ?", (alarm_id,))
            alarm = cursor.fetchone()
            if not alarm:
                return

            from_state = alarm["state"]
            cursor.execute("""
                UPDATE alarms SET
                    state = 'RESOLVED',
                    resolved_at = ?,
                    resolved_at_epoch = ?,
                    resolution_reason = ?,
                    current_value = ?
                WHERE id = ?
            """, (resolved_at_iso, resolved_at_epoch, reason, current_value, alarm_id))

            cursor.execute("""
                INSERT INTO alarm_transitions (
                    alarm_id, from_state, to_state, reason, value,
                    timestamp, timestamp_epoch
                ) VALUES (?, ?, 'RESOLVED', ?, ?, ?, ?)
            """, (alarm_id, from_state, reason, current_value, resolved_at_iso, resolved_at_epoch))

        # Enforce cooldown on manual or automated resolution & reset pending evaluation
        cond_key = (alarm["rule_id"], alarm["service"])
        self._last_resolved[cond_key] = resolved_at_epoch
        self._pending_conditions.pop(cond_key, None)

        history_service.record_event(
            source="AlarmEngine",
            event_type="alarm_resolved",
            severity="INFO",
            service=alarm["service"],
            message=f"Alarm #{alarm_id} ({alarm['metric']}) resolved: {reason}",
            status="resolved",
            metadata={"alarm_id": alarm_id, "reason": reason}
        )

    def transition_alarm_state(
        self,
        alarm_id: int,
        to_state: str,
        reason: str = "",
        value: Optional[float] = None
    ) -> bool:
        """Transitions an alarm to a new state and records in audit trail."""
        now_iso, now_epoch = current_iso_time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM alarms WHERE id = ?", (alarm_id,))
            alarm = cursor.fetchone()
            if not alarm:
                return False

            from_state = alarm["state"]
            val_to_record = value if value is not None else alarm["current_value"]

            cursor.execute("""
                UPDATE alarms SET
                    state = ?,
                    current_value = ?,
                    last_evaluated_at = ?
                WHERE id = ?
            """, (to_state, val_to_record, now_iso, alarm_id))

            cursor.execute("""
                INSERT INTO alarm_transitions (
                    alarm_id, from_state, to_state, reason, value,
                    timestamp, timestamp_epoch
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (alarm_id, from_state, to_state, reason, val_to_record, now_iso, now_epoch))

        history_service.record_event(
            source="AlarmEngine",
            event_type="alarm_transition",
            severity="CRITICAL" if to_state == "AWAITING_APPROVAL" else "INFO",
            service=alarm["service"],
            message=f"Alarm #{alarm_id} transitioned: {from_state} -> {to_state}. Reason: {reason}",
            status=to_state.lower(),
            metadata={"alarm_id": alarm_id, "from_state": from_state, "to_state": to_state, "reason": reason}
        )
        return True

    def query_alarms(
        self,
        status: Optional[str] = None,
        severity: Optional[str] = None,
        service: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        conditions = []
        params = []

        if status:
            if status.lower() == "active":
                conditions.append("a.state != 'RESOLVED'")
            elif status.lower() == "firing":
                conditions.append("a.state IN ('FIRING', 'VERIFICATION_FAILED', 'ESCALATED')")
            elif status.lower() == "resolved":
                conditions.append("a.state = 'RESOLVED'")
            elif status.lower() == "awaiting_approval":
                conditions.append("a.state = 'AWAITING_APPROVAL'")
            elif status.lower() != "all":
                conditions.append("a.state = ?")
                params.append(status.upper())

        if severity and severity.lower() != "all":
            conditions.append("a.severity = ?")
            params.append(severity.upper())

        if service and service.lower() != "all":
            conditions.append("a.service = ?")
            params.append(service)

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        query = f"""
            SELECT a.*, r.name as rule_name, r.operator, r.threshold, r.duration_seconds
            FROM alarms a
            LEFT JOIN alarm_rules r ON a.rule_id = r.id
            {where_clause}
            ORDER BY a.started_at_epoch DESC
            LIMIT ?
        """

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params + [limit])
            rows = cursor.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                # Attach incident summary if exists
                cursor.execute("SELECT incident_id, risk_level, execution_mode, action_type, diagnosis, status as incident_status FROM incident_records WHERE alarm_id = ? ORDER BY id DESC LIMIT 1", (item["id"],))
                inc = cursor.fetchone()
                if inc:
                    item["incident_id"] = inc["incident_id"]
                    item["risk_level"] = inc["risk_level"]
                    item["execution_mode"] = inc["execution_mode"]
                    item["action_type"] = inc["action_type"]
                    item["diagnosis"] = inc["diagnosis"]
                results.append(item)
            return results

    def get_alarm_details(self, alarm_id: int) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT a.*, r.name as rule_name, r.operator, r.threshold, r.duration_seconds, r.description as rule_description
                FROM alarms a
                LEFT JOIN alarm_rules r ON a.rule_id = r.id
                WHERE a.id = ?
            """, (alarm_id,))
            alarm = cursor.fetchone()
            if not alarm:
                return None

            cursor.execute("""
                SELECT * FROM alarm_transitions 
                WHERE alarm_id = ? 
                ORDER BY timestamp_epoch ASC
            """, (alarm_id,))
            transitions = [dict(r) for r in cursor.fetchall()]

            # Fetch linked incident record
            cursor.execute("""
                SELECT * FROM incident_records 
                WHERE alarm_id = ? 
                ORDER BY id DESC LIMIT 1
            """, (alarm_id,))
            inc_row = cursor.fetchone()
            incident_data = None
            if inc_row:
                incident_data = dict(inc_row)
                if incident_data.get("proposed_action"):
                    try:
                        incident_data["proposed_action"] = json.loads(incident_data["proposed_action"])
                    except Exception:
                        pass
                if incident_data.get("metadata"):
                    try:
                        incident_data["metadata"] = json.loads(incident_data["metadata"])
                    except Exception:
                        pass

            alarm_dict = dict(alarm)
            alarm_dict["transitions"] = transitions
            alarm_dict["incident"] = incident_data
            return alarm_dict

    def get_alarm_correlation(self, alarm_id: int) -> Optional[Dict[str, Any]]:
        """
        Correlates an alarm with:
        1. Historical metric time series focused around the incident window (start - 3m to resolve + 3m)
        2. Related events occurring in that window (chaos injections, agent actions, transitions)
        3. Associated Agent Decision Record & Autonomous SRE incident data
        """
        alarm = self.get_alarm_details(alarm_id)
        if not alarm:
            return None

        # Time window: 3 minutes before started_at to 3 minutes after resolved_at (or now)
        start_epoch = alarm["started_at_epoch"] - 180
        end_epoch = (alarm["resolved_at_epoch"] + 180) if alarm["resolved_at_epoch"] else (time.time() + 60)

        # 1. Fetch metric series
        metric_data = history_service.query_metrics_downsampled(
            service=alarm["service"],
            metric_name=alarm["metric"],
            time_range="custom",
            custom_start=start_epoch,
            custom_end=end_epoch,
            target_points=120
        )

        # 2. Fetch related events
        events_data = history_service.query_events(
            start_time=start_epoch,
            end_time=end_epoch,
            page=1,
            page_size=100
        )

        return {
            "alarm": alarm,
            "incident": alarm.get("incident"),
            "metric_series": metric_data["points"],
            "related_events": events_data["events"],
            "incident_window": {
                "start": start_epoch,
                "end": end_epoch
            }
        }

alarm_engine = AlarmEngine()
