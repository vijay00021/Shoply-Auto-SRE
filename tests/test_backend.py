import time
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from main import app
from services.database import init_db
from services.history_service import history_service
from services.alarm_engine import alarm_engine

client = TestClient(app)

def run_tests():
    print("[1/6] Initializing database...")
    init_db()

    print("[2/6] Testing status and metrics endpoints...")
    res = client.get("/api/status")
    assert res.status_code == 200, f"Status check failed: {res.text}"
    assert "system_state" in res.json()
    assert "logs" in res.json()

    res = client.get("/api/metrics")
    assert res.status_code == 200
    assert "paymentservice" in res.json()
    print("  -> Status and metrics endpoints OK.")

    print("[3/6] Testing metric persistence and downsampling query...")
    snapshot = {
        "paymentservice": {"latency_p95_ms": 120, "error_rate": 1.5, "requests_per_sec": 45},
        "frontend": {"latency_p95_ms": 25, "error_rate": 0.0, "requests_per_sec": 120}
    }
    history_service.record_metrics_batch(snapshot)
    res = client.get("/api/history/metrics?service=paymentservice&metric_name=latency_p95_ms&range=1h")
    assert res.status_code == 200, f"Metrics query failed: {res.text}"
    data = res.json()
    assert data["service"] == "paymentservice"
    assert len(data["points"]) > 0
    print(f"  -> Metric persistence OK ({len(data['points'])} points returned).")

    print("[4/6] Testing event persistence, filtering, and pagination...")
    ev1 = history_service.record_event(
        source="TestRunner",
        event_type="test_event",
        severity="ERROR",
        service="paymentservice",
        message="Payment database connection timed out",
        status="active"
    )
    ev2 = history_service.record_event(
        source="TestRunner",
        event_type="test_event",
        severity="INFO",
        service="frontend",
        message="Frontend cache refreshed",
        status="completed"
    )
    
    # Query with severity filter
    res = client.get("/api/history/events?severity=ERROR")
    assert res.status_code == 200
    err_events = res.json()["events"]
    assert len(err_events) >= 1
    assert all(e["severity"] == "ERROR" for e in err_events)

    # Query with search keyword
    res = client.get("/api/history/events?search=database")
    assert res.status_code == 200
    assert len(res.json()["events"]) >= 1
    print("  -> Event persistence & filtering OK.")

    print("[5/6] Testing alarm engine sustained-condition, deduplication, and transitions...")
    # Add rule with 1s duration
    rule_data = {
        "id": "rule_test_burst",
        "name": "Test Burst Latency",
        "metric": "latency_p95_ms",
        "target_service": "paymentservice",
        "operator": ">",
        "threshold": 500.0,
        "duration_seconds": 1,
        "severity": "CRITICAL",
        "enabled": True,
        "cooldown_seconds": 2,
        "recovery_threshold": 100.0,
        "description": "Test sustained latency alarm"
    }
    client.post("/api/alarm-rules", json=rule_data)

    # Tick 1: Condition breached, but duration not reached
    high_metrics = {"paymentservice": {"latency_p95_ms": 600, "error_rate": 0, "requests_per_sec": 50}}
    alarm_engine.evaluate(high_metrics)
    active = [a for a in client.get("/api/alarms?status=active").json() if a["rule_id"] == "rule_test_burst"]
    assert len(active) == 0, "Alarm should not fire before sustained duration!"

    # Wait for duration
    time.sleep(1.2)

    # Tick 2: Condition still breached -> Fires!
    alarm_engine.evaluate(high_metrics)
    active = [a for a in client.get("/api/alarms?status=active").json() if a["rule_id"] == "rule_test_burst"]
    assert len(active) == 1, "Alarm should fire after sustained duration!"
    alarm_id = active[0]["id"]
    assert active[0]["state"] == "FIRING"

    # Tick 3: High metrics continue -> Deduplication check
    alarm_engine.evaluate(high_metrics)
    active = [a for a in client.get("/api/alarms?status=active").json() if a["rule_id"] == "rule_test_burst"]
    assert len(active) == 1, "Deduplication failed: multiple alarm instances created!"

    # Test acknowledgement
    ack_res = client.post(f"/api/alarms/{alarm_id}/acknowledge", json={"acknowledged_by": "alice", "note": "Handling"})
    assert ack_res.status_code == 200
    alarm_detail = client.get(f"/api/alarms/{alarm_id}").json()
    assert alarm_detail["state"] == "ACKNOWLEDGED"

    # Tick 4: Metrics recover -> Auto-resolution
    normal_metrics = {"paymentservice": {"latency_p95_ms": 50, "error_rate": 0, "requests_per_sec": 50}}
    alarm_engine.evaluate(normal_metrics)
    alarm_detail = client.get(f"/api/alarms/{alarm_id}").json()
    assert alarm_detail["state"] == "RESOLVED"
    assert alarm_detail["resolved_at"] is not None
    print(f"  -> Alarm lifecycle OK (FIRING -> ACKNOWLEDGED -> RESOLVED). Transitions: {len(alarm_detail['transitions'])}")

    print("[6/6] Testing alarm correlation endpoint...")
    cor_res = client.get(f"/api/alarms/{alarm_id}/correlation")
    assert cor_res.status_code == 200
    cor_data = cor_res.json()
    assert "metric_series" in cor_data
    assert "related_events" in cor_data
    assert "incident_window" in cor_data
    print(f"  -> Alarm correlation OK ({len(cor_data['metric_series'])} metric points, {len(cor_data['related_events'])} related events).")

    # =========================================================================
    # EXTENDED AUTONOMOUS SRE TESTS: 3-LEVEL AUTONOMY & POLICY GUARDRAILS
    # =========================================================================
    print("[7/10] Testing Policy / Guardrail Engine (Action Risk & Limits)...")
    from services.policy_engine import policy_engine
    from services.incident_orchestrator import incident_orchestrator

    # 1. Level 1: Safe, reversible pod restart
    eval_safe = policy_engine.evaluate_action({"action": "restart_pod", "target": "deployment/payment-db"})
    assert eval_safe["allowed"] is True
    assert eval_safe["mode"] == "AUTO"
    assert eval_safe["risk_level"] == "LOW"

    # 2. Level 2: Safe scaling within limit (<= 3 replicas)
    eval_notify = policy_engine.evaluate_action({"action": "scale_deployment", "target": "deployment/frontend", "replicas": 3})
    assert eval_notify["allowed"] is True
    assert eval_notify["mode"] == "AUTO_NOTIFY"
    assert eval_notify["risk_level"] == "MEDIUM"

    # 3. Level 3: Scaling exceeding safe limit (> 3 replicas) -> Blocked by Guardrail!
    eval_over_limit = policy_engine.evaluate_action({"action": "scale_deployment", "target": "deployment/frontend", "replicas": 8})
    assert eval_over_limit["allowed"] is False
    assert eval_over_limit["mode"] == "APPROVAL_REQUIRED"
    assert eval_over_limit["risk_level"] == "HIGH"
    assert "exceeds" in eval_over_limit["reason"].lower()

    # 4. Level 3: Risky config change -> Blocked by Policy
    eval_config = policy_engine.evaluate_action({"action": "modify_production_config", "target": "configmap/cfg"})
    assert eval_config["allowed"] is False
    assert eval_config["mode"] == "APPROVAL_REQUIRED"
    assert eval_config["risk_level"] == "HIGH"

    # 5. Policies API: List and update policy
    res_pols = client.get("/api/policies")
    assert res_pols.status_code == 200
    pols = res_pols.json()
    assert len(pols) >= 5

    # Policy update endpoint
    res_upd = client.put("/api/policies/modify_production_config", json={"description": "Updated policy description"})
    assert res_upd.status_code == 200
    assert res_upd.json()["description"] == "Updated policy description"
    print("  -> Policy / Guardrail Engine OK.")

    print("[8/10] Testing Autonomous Workflows (Level 1 Auto-Heal & Level 2 Auto-Notify)...")
    # Test Level 1: DB Pod Crash Auto-Heal (Safe, no human intervention)
    import asyncio
    l1_res = asyncio.run(incident_orchestrator.run_autonomous_workflow("payment_crash"))
    assert l1_res["status"] == "completed"
    assert l1_res["mode"] == "AUTO"
    assert l1_res["verified"] is True
    inc_l1 = incident_orchestrator.get_incident_by_id(l1_res["incident_id"])
    assert inc_l1["status"] == "RESOLVED"
    assert inc_l1["trigger_value"] is not None
    assert inc_l1["current_value"] is not None

    # Test Level 2: Traffic Spike Auto-Heal + Notify (Safe scaling within limit)
    l2_res = asyncio.run(incident_orchestrator.run_autonomous_workflow("frontend_traffic"))
    assert l2_res["status"] == "completed"
    assert l2_res["mode"] == "AUTO_NOTIFY"
    assert l2_res["verified"] is True
    inc_l2 = incident_orchestrator.get_incident_by_id(l2_res["incident_id"])
    assert inc_l2["status"] == "RESOLVED"

    # Check that an admin_notified event was recorded in History
    ev_notify = client.get("/api/history/events?event_type=admin_notified").json()
    assert len(ev_notify["events"]) >= 1
    print("  -> Level 1 Auto-Heal & Level 2 Auto-Notify OK.")

    print("[9/10] Testing Level 3 Escalation, Human Rejection, and Human Approval...")
    # Trigger Level 3: Risky config drift scenario -> requires human approval
    l3_res = asyncio.run(incident_orchestrator.run_autonomous_workflow("production_config_drift"))
    assert l3_res["status"] == "awaiting_approval"
    assert l3_res["mode"] == "APPROVAL_REQUIRED"
    alarm_id_l3 = l3_res["alarm_id"]
    inc_id_l3 = l3_res["incident_id"]

    # Verify alarm is in AWAITING_APPROVAL
    alarm_l3 = client.get(f"/api/alarms/{alarm_id_l3}").json()
    assert alarm_l3["state"] == "AWAITING_APPROVAL"
    assert "incident" in alarm_l3
    assert alarm_l3["incident"]["incident_id"] == inc_id_l3
    assert alarm_l3["incident"]["risk_level"] == "HIGH"

    # Scenario 5: Admin REJECTS the risky remediation
    rej_res = client.post(f"/api/alarms/{alarm_id_l3}/reject", json={"rejected_by": "bob", "reason": "Change too risky during business hours"})
    assert rej_res.status_code == 200
    rej_data = rej_res.json()
    assert rej_data["status"] == "rejected"
    assert rej_data["executed"] is False

    # Check alarm transitioned to REJECTED and action was NOT executed
    alarm_rej = client.get(f"/api/alarms/{alarm_id_l3}").json()
    assert alarm_rej["state"] == "REJECTED"
    inc_rej = incident_orchestrator.get_incident_by_id(inc_id_l3)
    assert inc_rej["status"] == "REJECTED"
    assert "NOT executed" in inc_rej["execution_result"]

    # Scenario 4: Admin APPROVES a risky remediation
    l3_approve_res = asyncio.run(incident_orchestrator.run_autonomous_workflow("production_config_drift_2"))
    alarm_id_app = l3_approve_res["alarm_id"]
    inc_id_app = l3_approve_res["incident_id"]

    app_res = client.post(f"/api/alarms/{alarm_id_app}/approve", json={"approved_by": "alice"})
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "approved_and_resolved"

    # Check alarm and incident are RESOLVED with complete audit trail
    alarm_app = client.get(f"/api/alarms/{alarm_id_app}").json()
    assert alarm_app["state"] == "RESOLVED"
    inc_app = incident_orchestrator.get_incident_by_id(inc_id_app)
    assert inc_app["status"] == "RESOLVED"
    assert "Recovery verified" in inc_app["verification_result"]
    print("  -> Level 3 Escalation, Rejection, and Approval Workflows OK.")

    print("[10/10] Testing Verification Failure, Metric Distinction, and Incident APIs...")
    # Scenario 6: Automatic remediation verification failure (Escalate, do NOT mark resolved!)
    fail_res = asyncio.run(incident_orchestrator.run_autonomous_workflow("payment_crash", will_fail_verification=True))
    assert fail_res["verified"] is False
    inc_fail = incident_orchestrator.get_incident_by_id(fail_res["incident_id"])
    assert inc_fail["status"] == "FAILED"
    assert "FAILED" in inc_fail["verification_result"]

    # Scenario 8: Distinct Trigger Value vs Current Value
    assert inc_app["trigger_value"] is not None
    assert inc_app["current_value"] is not None
    assert inc_app["trigger_value"] != inc_app["current_value"]

    # Incidents APIs
    all_incidents = client.get("/api/incidents").json()
    assert len(all_incidents) >= 4

    single_inc = client.get(f"/api/incidents/{inc_id_app}").json()
    assert single_inc["incident_id"] == inc_id_app

    alarm_inc = client.get(f"/api/alarms/{alarm_id_app}/incident").json()
    assert alarm_inc["incident_id"] == inc_id_app
    print("  -> Verification Failure handling, Trigger vs Current Values, and Incident APIs OK.")

    print("\n===========================================================")
    print("ALL BACKEND & AUTONOMOUS SRE VERIFICATION TESTS PASSED (10/10)!")
    print("===========================================================")

if __name__ == "__main__":
    run_tests()
