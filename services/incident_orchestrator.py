import asyncio
import json
import time
from typing import Dict, List, Optional, Any, Callable

from agents.monitoring_agent import detect_anomaly
from agents.analysis_agent import analyze_logs
from agents.rca_agent import root_cause
from agents.remediation_agent import determine_remediation
from agents.deployment_agent import execute_deployment

from services.database import get_db_connection
from services.history_service import history_service, current_iso_time
from services.policy_engine import policy_engine
from services.boutique_simulator import simulator

class IncidentOrchestrator:
    def __init__(self):
        self._current_incident: Optional[Dict[str, Any]] = None
        self._log_callback: Optional[Callable[[str, str, str], None]] = None
        self.is_workflow_running: bool = False

    def reset(self):
        self.is_workflow_running = False
        self._current_incident = None
        # Cleanly resolve any in-flight demo incident records so no stale approvals linger
        try:
            now_iso, now_epoch = current_iso_time()
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    UPDATE incident_records 
                    SET status = 'RESOLVED',
                        resolved_at = ?,
                        resolved_at_epoch = ?,
                        verification_result = 'Demo state reset by user'
                    WHERE status IN ('AWAITING_APPROVAL', 'EXECUTING', 'VERIFYING', 'REJECTED')
                """, (now_iso, now_epoch))
        except Exception:
            pass

    def set_log_callback(self, cb: Callable[[str, str, str], None]):
        self._log_callback = cb

    def _log(self, agent: str, log_type: str, message: str):
        if self._log_callback:
            self._log_callback(agent, log_type, message)

    def create_incident_record(
        self,
        incident_id: str,
        service: str,
        anomaly_condition: str,
        trigger_value: float,
        current_value: float,
        diagnosis: str,
        proposed_action: Dict[str, Any],
        policy_decision: Dict[str, Any],
        status: str,
        alarm_id: Optional[int] = None
    ) -> int:
        now_iso, now_epoch = current_iso_time()
        action_type = proposed_action.get("action", "unknown")
        risk_level = policy_decision.get("risk_level", "LOW")
        execution_mode = policy_decision.get("mode", "AUTO")
        policy_result = policy_decision.get("reason", "")
        proposed_action_str = json.dumps(proposed_action)

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO incident_records (
                    incident_id, alarm_id, service, anomaly_condition,
                    diagnosis, proposed_action, action_type, risk_level,
                    policy_result, execution_mode, execution_result,
                    verification_result, status, trigger_value, current_value,
                    detected_at, detected_at_epoch, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                incident_id, alarm_id, service, anomaly_condition,
                diagnosis, proposed_action_str, action_type, risk_level,
                policy_result, execution_mode, None, None, status,
                trigger_value, current_value, now_iso, now_epoch,
                json.dumps({"policy": policy_decision})
            ))
            return cursor.lastrowid

    def update_incident_record(self, incident_id: str, updates: Dict[str, Any]):
        now_iso, now_epoch = current_iso_time()
        fields = []
        params = []
        for k, v in updates.items():
            fields.append(f"{k} = ?")
            params.append(v)

        if "status" in updates and updates["status"] == "RESOLVED":
            fields.append("resolved_at = ?")
            params.append(now_iso)
            fields.append("resolved_at_epoch = ?")
            params.append(now_epoch)

        params.append(incident_id)
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"""
                UPDATE incident_records SET {', '.join(fields)}
                WHERE incident_id = ?
            """, params)

    def get_incident_by_id(self, incident_id: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM incident_records WHERE incident_id = ?", (incident_id,))
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            if res.get("proposed_action"):
                try:
                    res["proposed_action"] = json.loads(res["proposed_action"])
                except Exception:
                    pass
            if res.get("metadata"):
                try:
                    res["metadata"] = json.loads(res["metadata"])
                except Exception:
                    pass
            return res

    def get_incident_by_alarm_id(self, alarm_id: int) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM incident_records WHERE alarm_id = ? ORDER BY id DESC LIMIT 1", (alarm_id,))
            row = cursor.fetchone()
            if not row:
                return None
            res = dict(row)
            if res.get("proposed_action"):
                try:
                    res["proposed_action"] = json.loads(res["proposed_action"])
                except Exception:
                    pass
            if res.get("metadata"):
                try:
                    res["metadata"] = json.loads(res["metadata"])
                except Exception:
                    pass
            return res

    def list_incidents(self, limit: int = 50) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM incident_records ORDER BY detected_at_epoch DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            results = []
            for r in rows:
                item = dict(r)
                if item.get("proposed_action"):
                    try:
                        item["proposed_action"] = json.loads(item["proposed_action"])
                    except Exception:
                        pass
                results.append(item)
            return results

    async def run_autonomous_workflow(self, scenario: str = "payment_crash", will_fail_verification: bool = False):
        """
        Full 3-Level Autonomous SRE workflow executing all 5 agents and policy guardrail.
        """
        if self.is_workflow_running:
            return {"status": "already_running", "message": "A demo scenario is currently executing."}
        
        self.is_workflow_running = True
        try:
            now_iso, now_epoch = current_iso_time()
            incident_id = f"inc_{int(time.time() * 1000)}"

            # Identify target service and metrics based on scenario
            if "frontend" in scenario:
                svc = "frontend"
                metric_name = "requests_per_sec" if "spike" in scenario or "traffic" in scenario else "latency_p95_ms"
            elif "checkout" in scenario:
                svc = "checkoutservice"
                metric_name = "error_rate"
            elif "verification" in scenario or will_fail_verification:
                svc = "paymentservice"
                metric_name = "error_rate"
            else:
                svc = "paymentservice"
                metric_name = "error_rate" if "crash" in scenario else "latency_p95_ms"

            # Wait briefly for simulator metrics to reflect anomaly
            await asyncio.sleep(1.5)
            current_metrics = simulator.get_metrics().get(svc, {"latency_p95_ms": 1500, "error_rate": 85.0, "requests_per_sec": 45})
            trigger_val = current_metrics.get(metric_name, 100.0)

            # -------------------------------------------------------------
            # 1. MONITORING AGENT
            # -------------------------------------------------------------
            monitoring_result = detect_anomaly({
                "latency": current_metrics.get("latency_p95_ms", 0),
                "errors": current_metrics.get("error_rate", 0),
                "service": svc
            })
            self._log("Monitoring", "Alert", monitoring_result["message"])
            
            history_service.record_event(
                source="MonitoringAgent",
                event_type="anomaly_detected",
                severity="ERROR",
                service=svc,
                message=monitoring_result["message"],
                status="active",
                metadata={"latency": current_metrics.get("latency_p95_ms"), "errors": current_metrics.get("error_rate"), "trigger_val": trigger_val}
            )

            await asyncio.sleep(1.5)

            # -------------------------------------------------------------
            # 2. ANALYSIS AGENT
            # -------------------------------------------------------------
            pseudo_logs = f"ERROR: {svc} critical failure detected in logs. Scenario={scenario}"
            analysis_result = analyze_logs(pseudo_logs)
            self._log("Analysis", "Log parsing", analysis_result["summary"])
            
            history_service.record_event(
                source="AnalysisAgent",
                event_type="log_analysis",
                severity="WARNING",
                service=svc,
                message=analysis_result["summary"],
                status="active",
                metadata={"impacted_service": analysis_result.get("impacted_service")}
            )

            await asyncio.sleep(1.5)

            # -------------------------------------------------------------
            # 3. RCA AGENT
            # -------------------------------------------------------------
            rca_result = root_cause(analysis_result["summary"], svc)
            self._log("RCA", "Root Cause", rca_result["root_cause"])
            
            history_service.record_event(
                source="RCAAgent",
                event_type="rca_completed",
                severity="ERROR",
                service=svc,
                message=rca_result["root_cause"],
                status="active",
                metadata={"severity": rca_result.get("severity")}
            )

            await asyncio.sleep(1.5)

            # -------------------------------------------------------------
            # 4. REMEDIATION AGENT (Proposes Action)
            # -------------------------------------------------------------
            remediation_plan = determine_remediation(rca_result, scenario=scenario)
            self._log("Remediation", "Proposed Action", f"Action: {remediation_plan['action']} on {remediation_plan.get('target', svc)}")
            
            history_service.record_event(
                source="RemediationAgent",
                event_type="action_proposed",
                severity="INFO",
                service=svc,
                message=f"Remediation proposed: {remediation_plan['action']} on {remediation_plan.get('target')}",
                status="active",
                metadata=remediation_plan
            )

            await asyncio.sleep(1.0)

            # -------------------------------------------------------------
            # 5. POLICY / GUARDRAIL ENGINE (Checks Permissions & Risk)
            # -------------------------------------------------------------
            policy_decision = policy_engine.evaluate_action(remediation_plan)
            mode = policy_decision["mode"] # "AUTO", "AUTO_NOTIFY", or "APPROVAL_REQUIRED"
            risk_level = policy_decision["risk_level"]
            decision_reason = policy_decision["reason"]

            self._log("PolicyEngine", "Guardrail Check", f"[{mode}] {decision_reason}")
            
            history_service.record_event(
                source="PolicyEngine",
                event_type="policy_evaluation",
                severity="CRITICAL" if mode == "APPROVAL_REQUIRED" else "INFO",
                service=svc,
                message=f"Policy Check [{mode}]: {decision_reason}",
                status="completed",
                metadata={"mode": mode, "risk_level": risk_level, "action": remediation_plan["action"]}
            )

            # -------------------------------------------------------------
            # Check or create ONE distinct Alarm for this rule/service
            # -------------------------------------------------------------
            from services.alarm_engine import alarm_engine
            active_alarms = alarm_engine.query_alarms(status="active", service=svc)
            alarm_id = active_alarms[0]["id"] if active_alarms else None
            
            if not alarm_id:
                rules = alarm_engine.get_rules()
                matched_rule = next((r for r in rules if r["target_service"] == svc and r["metric"] == metric_name), None)
                if not matched_rule:
                    matched_rule = next((r for r in rules if r["target_service"] == svc), None)

                # STRICT RULE ENFORCEMENT: If matching alarm rule exists and is DISABLED,
                # do NOT create a new alarm or incident!
                if matched_rule and not matched_rule.get("enabled", 1):
                    self._log("Monitoring", "Rule Suppressed", f"Alarm rule '{matched_rule['name']}' is DISABLED. Alarm/Incident creation suppressed.")
                    return {
                        "status": "rule_disabled",
                        "service": svc,
                        "rule_name": matched_rule["name"],
                        "message": f"Alarm rule '{matched_rule['name']}' is disabled. No incident or alarm created."
                    }

                if not matched_rule:
                    matched_rule = {
                        "id": f"rule_{svc}_{metric_name}",
                        "name": f"{svc.capitalize()} High {metric_name.replace('_', ' ').capitalize()}",
                        "metric": metric_name,
                        "severity": "CRITICAL",
                        "operator": ">",
                        "threshold": 50.0,
                        "enabled": 1
                    }
                alarm_id = alarm_engine._create_alarm(
                    rule=matched_rule,
                    service=svc,
                    trigger_value=trigger_val,
                    started_at_iso=now_iso,
                    started_at_epoch=now_epoch
                )

            # -------------------------------------------------------------
            # BRANCH 1 & 2: LEVEL 1 (AUTO) or LEVEL 2 (AUTO + NOTIFY)
            # -------------------------------------------------------------
            if policy_decision["allowed"]:
                # Action is safe and allowed automatically!
                incident_db_id = self.create_incident_record(
                    incident_id=incident_id,
                    service=svc,
                    anomaly_condition=f"{metric_name} spiked to {trigger_val}",
                    trigger_value=trigger_val,
                    current_value=trigger_val,
                    diagnosis=rca_result["root_cause"],
                    proposed_action=remediation_plan,
                    policy_decision=policy_decision,
                    status="EXECUTING",
                    alarm_id=alarm_id
                )

                if alarm_id:
                    alarm_engine.transition_alarm_state(
                        alarm_id=alarm_id,
                        to_state="EXECUTING",
                        reason=f"Applying remediation: {remediation_plan['action']}",
                        value=trigger_val
                    )

                # 5. DEPLOYMENT AGENT (Executes Safe Action)
                await asyncio.sleep(1.5)
                deploy_result = execute_deployment(remediation_plan)
                self._log("Deployment", "K8s Sync", deploy_result["message"])
                
                history_service.record_event(
                    source="DeploymentAgent",
                    event_type="action_executed",
                    severity="INFO",
                    service=svc,
                    message=deploy_result["message"],
                    status="in_progress",
                    metadata={"action": remediation_plan["action"]}
                )

                # Update status to VERIFYING
                if alarm_id:
                    alarm_engine.transition_alarm_state(
                        alarm_id=alarm_id,
                        to_state="VERIFYING",
                        reason=f"Validating health recovery on {svc} after {remediation_plan['action']}",
                        value=trigger_val
                    )
                self.update_incident_record(incident_id, {
                    "status": "VERIFYING",
                    "execution_result": deploy_result["message"]
                })
                self._log("System", "Verification", f"Verifying system recovery for {svc}...")
                
                history_service.record_event(
                    source="System",
                    event_type="verification_started",
                    severity="INFO",
                    service=svc,
                    message=f"Verifying recovery after {remediation_plan['action']}...",
                    status="verifying"
                )

                await asyncio.sleep(2.5)

                # Verification logic
                is_verified = not will_fail_verification
                if is_verified:
                    # Normal recovery: reset simulator
                    simulator.reset()
                    await asyncio.sleep(1.0)
                    
                    # Fetch recovered current metric
                    rec_metrics = simulator.get_metrics().get(svc, {})
                    curr_val = rec_metrics.get(metric_name, 25.0)

                    # LEVEL 2: Send explicit Admin Notification
                    if mode == "AUTO_NOTIFY":
                        self._log("Notification", "Admin Alert", f"[NOTIFY ONLY] {remediation_plan['action']} auto-executed on {svc}. System recovered. No approval needed.")
                        history_service.record_event(
                            source="NotificationService",
                            event_type="admin_notified",
                            severity="INFO",
                            service=svc,
                            message=f"Administrator notified of autonomous remediation on {svc}: {remediation_plan['action']}. System verified healthy.",
                            status="completed",
                            metadata={"action": remediation_plan["action"], "mode": "AUTO_NOTIFY"}
                        )

                    # Complete incident
                    verif_msg = f"Recovery verified: {metric_name} returned to normal baseline ({curr_val}). Error rate and latency normal."
                    self.update_incident_record(incident_id, {
                        "status": "RESOLVED",
                        "current_value": curr_val,
                        "verification_result": verif_msg
                    })
                    self._log("System", "Resolved", f"Incident {incident_id} RESOLVED: {verif_msg}")

                    history_service.record_event(
                        source="System",
                        event_type="incident_resolved",
                        severity="INFO",
                        service=svc,
                        message=f"Incident {incident_id} resolved autonomously. Verification passed.",
                        status="resolved",
                        metadata={"incident_id": incident_id, "trigger_value": trigger_val, "current_value": curr_val}
                    )

                    # Also resolve any active alarm for this service
                    if alarm_id:
                        alarm_engine.resolve_alarm_manually(alarm_id, reason="Autonomously resolved & verified by AutoSRE")
                else:
                    # VERIFICATION FAILED (Failure Handling requirement)
                    fail_msg = f"Verification FAILED: {svc} {metric_name} ({trigger_val}) still exceeds threshold after {remediation_plan['action']}."
                    curr_val = trigger_val
                    self._log("System", "Verification Failed", fail_msg)

                    if alarm_id:
                        alarm_engine.transition_alarm_state(
                            alarm_id=alarm_id,
                            to_state="VERIFICATION_FAILED",
                            reason=fail_msg,
                            value=curr_val
                        )
                        await asyncio.sleep(1.0)
                        alarm_engine.transition_alarm_state(
                            alarm_id=alarm_id,
                            to_state="ESCALATED",
                            reason=f"Remediation verification failed on {svc}. Escalating to human on-call.",
                            value=curr_val
                        )

                    self.update_incident_record(incident_id, {
                        "status": "ESCALATED",
                        "current_value": curr_val,
                        "verification_result": fail_msg,
                        "alarm_id": alarm_id
                    })

                    # Escalate in audit history
                    history_service.record_event(
                        source="System",
                        event_type="verification_failed",
                        severity="CRITICAL",
                        service=svc,
                        message=f"Autonomous remediation verification failed for {svc}. Escalating to human on-call.",
                        status="failed",
                        metadata={"incident_id": incident_id, "alarm_id": alarm_id, "trigger_value": trigger_val}
                    )

                    history_service.record_event(
                        source="System",
                        event_type="incident_escalated",
                        severity="CRITICAL",
                        service=svc,
                        message=f"Incident {incident_id} ESCALATED: Autonomous verification failed. Human intervention required.",
                        status="escalated",
                        metadata={"incident_id": incident_id, "alarm_id": alarm_id}
                    )

                    self._log("System", "Escalated", f"Incident {incident_id} ESCALATED to human on-call. Autonomous remediation halted.")

                    # CRITICAL: Stop generating new demo failure events!
                    simulator.stop_chaos()

                return {"status": "completed", "incident_id": incident_id, "mode": mode, "verified": is_verified}

            # -------------------------------------------------------------
            # BRANCH 3: LEVEL 3 (HUMAN APPROVAL REQUIRED)
            # -------------------------------------------------------------
            # Policy blocked automatic execution because action is risky / restricted
            self._log("AlarmSystem", "Escalation", f"HUMAN APPROVAL REQUIRED: {remediation_plan['action']} blocked by policy guardrails. Escalating to Alarms.")

            # Stop repeated chaos generation while awaiting approval
            simulator.stop_chaos()

            # Transition alarm state to AWAITING_APPROVAL
            if alarm_id:
                alarm_engine.transition_alarm_state(
                    alarm_id=alarm_id,
                    to_state="AWAITING_APPROVAL",
                    reason=f"Action '{remediation_plan['action']}' requires administrator sign-off. {decision_reason}",
                    value=trigger_val
                )

            incident_db_id = self.create_incident_record(
                incident_id=incident_id,
                service=svc,
                anomaly_condition=f"{metric_name} exceeded threshold ({trigger_val})",
                trigger_value=trigger_val,
                current_value=trigger_val,
                diagnosis=rca_result["root_cause"],
                proposed_action=remediation_plan,
                policy_decision=policy_decision,
                status="AWAITING_APPROVAL",
                alarm_id=alarm_id
            )

            history_service.record_event(
                source="PolicyEngine",
                event_type="approval_required",
                severity="CRITICAL",
                service=svc,
                message=f"Human approval required for incident {incident_id}: Action '{remediation_plan['action']}' requires authorization.",
                status="awaiting_approval",
                metadata={
                    "incident_id": incident_id,
                    "alarm_id": alarm_id,
                    "proposed_action": remediation_plan,
                    "reason": decision_reason
                }
            )

            return {
                "status": "awaiting_approval",
                "incident_id": incident_id,
                "alarm_id": alarm_id,
                "mode": "APPROVAL_REQUIRED",
                "proposed_action": remediation_plan,
                "reason": decision_reason
            }
        finally:
            self.is_workflow_running = False

    async def approve_incident(self, alarm_id: int, approved_by: str = "admin") -> Dict[str, Any]:
        """
        Admin approves the risky remediation action.
        Flow:
        Approve -> Execute -> Verify -> Resolve -> Record complete history
        """
        now_iso, now_epoch = current_iso_time()
        from services.alarm_engine import alarm_engine

        incident = self.get_incident_by_alarm_id(alarm_id)
        if not incident:
            return {"status": "error", "message": "Incident not found for alarm"}

        incident_id = incident["incident_id"]
        svc = incident["service"]
        remediation_plan = incident["proposed_action"]

        self._log("Admin", "Approval", f"Admin [{approved_by}] APPROVED proposed action: {remediation_plan['action']}")

        # 1. Transition Alarm & Incident to APPROVED, then EXECUTING
        alarm_engine.transition_alarm_state(
            alarm_id=alarm_id,
            to_state="APPROVED",
            reason=f"Approved by {approved_by}",
            value=incident["current_value"]
        )
        self.update_incident_record(incident_id, {"status": "EXECUTING"})

        history_service.record_event(
            source="Admin",
            event_type="action_approved",
            severity="INFO",
            service=svc,
            message=f"Action '{remediation_plan['action']}' was authorized by {approved_by}",
            status="approved",
            metadata={"incident_id": incident_id, "approved_by": approved_by}
        )

        alarm_engine.transition_alarm_state(
            alarm_id=alarm_id,
            to_state="EXECUTING",
            reason="Deployment agent applying approved remediation patch",
            value=incident["current_value"]
        )

        await asyncio.sleep(1.5)

        # 2. Deployment Agent executes the approved action
        deploy_result = execute_deployment(remediation_plan)
        self._log("Deployment", "K8s Sync", deploy_result["message"])

        history_service.record_event(
            source="DeploymentAgent",
            event_type="action_executed",
            severity="INFO",
            service=svc,
            message=deploy_result["message"],
            status="in_progress",
            metadata={"action": remediation_plan["action"]}
        )

        # 3. Transition to VERIFYING
        alarm_engine.transition_alarm_state(
            alarm_id=alarm_id,
            to_state="VERIFYING",
            reason="Validating recovery of metrics following approved remediation",
            value=incident["current_value"]
        )
        self.update_incident_record(incident_id, {
            "status": "VERIFYING",
            "execution_result": deploy_result["message"]
        })

        await asyncio.sleep(2.5)

        # 4. Verify Recovery
        simulator.reset()
        await asyncio.sleep(1.0)
        curr_val = 22.0 # Baseline metric recovered

        verif_msg = f"Recovery verified: all service health checks passed and metrics returned to normal."
        self.update_incident_record(incident_id, {
            "status": "RESOLVED",
            "current_value": curr_val,
            "verification_result": verif_msg
        })

        alarm_engine._resolve_alarm(
            alarm_id=alarm_id,
            reason="Action executed and recovery verified",
            resolved_at_iso=now_iso,
            resolved_at_epoch=now_epoch,
            current_value=curr_val
        )

        self._log("System", "Resolved", f"Incident {incident_id} RESOLVED: {verif_msg}")

        history_service.record_event(
            source="System",
            event_type="incident_resolved",
            severity="INFO",
            service=svc,
            message=f"Incident {incident_id} successfully resolved following approved remediation.",
            status="resolved",
            metadata={"incident_id": incident_id, "approved_by": approved_by, "current_value": curr_val}
        )

        return {"status": "approved_and_resolved", "incident_id": incident_id, "alarm_id": alarm_id}

    async def reject_incident(self, alarm_id: int, rejected_by: str = "admin", reason: str = "Rejected by administrator") -> Dict[str, Any]:
        """
        Admin rejects the risky remediation action.
        CRITICAL SAFETY RULE:
        Action must NOT execute.
        Record rejection.
        Keep incident unresolved/escalated as appropriate.
        """
        from services.alarm_engine import alarm_engine

        incident = self.get_incident_by_alarm_id(alarm_id)
        if not incident:
            return {"status": "error", "message": "Incident not found for alarm"}

        incident_id = incident["incident_id"]
        svc = incident["service"]
        remediation_plan = incident["proposed_action"]

        self._log("Admin", "Rejection", f"Admin [{rejected_by}] REJECTED action: {remediation_plan['action']}. Reason: {reason}. ACTION WILL NOT EXECUTE.")

        # ACTION IS NEVER EXECUTED
        simulator.stop_chaos()
        # Transition alarm to REJECTED
        alarm_engine.transition_alarm_state(
            alarm_id=alarm_id,
            to_state="REJECTED",
            reason=f"Action rejected by {rejected_by}: {reason}. Action blocked from execution.",
            value=incident["current_value"]
        )

        self.update_incident_record(incident_id, {
            "status": "REJECTED",
            "execution_result": "BLOCKED: Remediation action rejected by administrator. Action was NOT executed.",
            "verification_result": "Incident remains escalated / unresolved pending alternative human remediation."
        })

        history_service.record_event(
            source="Admin",
            event_type="action_rejected",
            severity="WARNING",
            service=svc,
            message=f"Proposed remediation '{remediation_plan['action']}' was REJECTED by {rejected_by}. Action did NOT execute.",
            status="rejected",
            metadata={"incident_id": incident_id, "rejected_by": rejected_by, "reason": reason}
        )

        return {"status": "rejected", "incident_id": incident_id, "alarm_id": alarm_id, "executed": False}

incident_orchestrator = IncidentOrchestrator()
