# main.py
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import asyncio

# Import agents
from agents.monitoring_agent import detect_anomaly
from agents.analysis_agent import analyze_logs
from agents.rca_agent import root_cause
from agents.remediation_agent import determine_remediation
from agents.deployment_agent import execute_deployment
from services.boutique_simulator import simulator

# Import persistent history and alarm services
from services.database import init_db
from services.history_service import history_service
from services.alarm_engine import alarm_engine
from services.policy_engine import policy_engine
from services.incident_orchestrator import incident_orchestrator

app = FastAPI(title="AutoSRE Agent Backend")

@app.on_event("startup")
async def startup_event():
    init_db()
    incident_orchestrator.set_log_callback(add_log)
    asyncio.create_task(simulator.run(add_log))

# Allow CORS for React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentResponse(BaseModel):
    agent: str
    type: str
    message: str
    timestamp: str

class ChaosScenario(BaseModel):
    scenario: str = "payment_crash"
    fail_verification: bool = False

class AcknowledgeRequest(BaseModel):
    acknowledged_by: str = "operator"
    note: str = ""

class ResolveRequest(BaseModel):
    resolution_reason: str = "Resolved by user"

class ApprovalRequest(BaseModel):
    approved_by: str = "admin"

class RejectionRequest(BaseModel):
    rejected_by: str = "admin"
    reason: str = "Rejected by administrator"

class PolicyUpdateModel(BaseModel):
    risk_level: Optional[str] = None
    auto_allowed: Optional[bool] = None
    notify_required: Optional[bool] = None
    approval_required: Optional[bool] = None
    max_limit: Optional[float] = None
    enabled: Optional[bool] = None
    description: Optional[str] = None

class AlarmRuleModel(BaseModel):
    id: Optional[str] = None
    name: str
    metric: str
    target_service: str
    operator: str
    threshold: float
    duration_seconds: int = 0
    severity: str = "WARNING"
    enabled: bool = True
    cooldown_seconds: int = 60
    recovery_threshold: Optional[float] = None
    description: Optional[str] = ""

# In-memory store for demo logs to be polled by frontend (backward compatibility)
demo_logs = []
current_system_state = "healthy"

def add_log(agent: str, log_type: str, message: str):
    from datetime import datetime
    time_str = datetime.now().strftime("%I:%M:%S %p")
    demo_logs.append({
        "agent": agent,
        "type": log_type,
        "message": message,
        "timestamp": time_str
    })
    if len(demo_logs) > 100:
        demo_logs.pop(0)
    
    # Do not write background heartbeat noise into persistent event history audit log
    if log_type == "HEARTBEAT":
        return

    # Also record in persistent event history audit log
    sev = "CRITICAL" if "FATAL" in message or "CRITICAL" in message else "ERROR" if log_type == "ERROR" else "WARNING" if "WARN" in message or "503" in message else "INFO"
    svc = agent.lower() if agent.lower() in simulator.metrics else "system"
    try:
        history_service.record_event(
            source=agent,
            event_type=log_type.lower().replace(" ", "_"),
            severity=sev,
            service=svc,
            message=message,
            status="active"
        )
    except Exception:
        pass

@app.get("/api/status")
async def get_status():
    """Returns the current overall system status and agent logs."""
    global current_system_state
    if current_system_state == "awaiting_approval":
        active_approvals = alarm_engine.query_alarms(status="awaiting_approval")
        if not active_approvals:
            current_system_state = "healthy"

    return {
        "system_state": current_system_state,
        "logs": demo_logs
    }

@app.get("/api/metrics")
async def get_metrics():
    """Returns the current metrics for all simulated boutique services."""
    return simulator.get_metrics()

@app.post("/api/reset")
async def reset_demo():
    """Resets the demo state completely."""
    global demo_logs, current_system_state
    demo_logs = []
    current_system_state = "healthy"
    simulator.reset()
    incident_orchestrator.reset()

    # Cleanly resolve any active firing alarms from demo scenarios
    try:
        from services.alarm_engine import alarm_engine
        from services.history_service import current_iso_time
        active = alarm_engine.query_alarms(status="active")
        now_str, now_epoch = current_iso_time()
        for a in active:
            alarm_engine._resolve_alarm(
                alarm_id=a["id"],
                reason="System demo state was reset by user",
                resolved_at_iso=now_str,
                resolved_at_epoch=now_epoch,
                current_value=a.get("current_value", 0.0)
            )
        alarm_engine._pending_conditions.clear()
    except Exception:
        pass

    try:
        history_service.record_event(
            source="System",
            event_type="system_reset",
            severity="INFO",
            service="system",
            message="System demo state was reset by user.",
            status="resolved"
        )
    except Exception:
        pass
    return {"status": "reset"}

@app.post("/api/trigger_chaos")
async def trigger_chaos(scenario: ChaosScenario, background_tasks: BackgroundTasks):
    """
    Simulates executing Chaos Mesh which triggers the Multi-Agent pipeline.
    """
    global current_system_state
    if incident_orchestrator.is_workflow_running:
        raise HTTPException(status_code=400, detail="A demo scenario is already running. Please wait or reset.")

    if current_system_state != "healthy":
        raise HTTPException(status_code=400, detail="System not healthy currently. Please reset demo first.")
        
    current_system_state = "anomaly"
    
    scen_name = scenario.scenario
    fail_verif = scenario.fail_verification or scen_name == "verification_failure"
    if scen_name == "verification_failure":
        scen_name = "verification_failure"
        fail_verif = True

    # Apply scenario to simulator
    simulator.trigger_chaos(scen_name)
    
    add_log("System", "Chaos Mesh", f"CRITICAL FAILURE INJECTED: {scen_name}")
    
    try:
        svc = "paymentservice" if "payment" in scen_name or "verification" in scen_name else "frontend"
        history_service.record_event(
            source="Chaos Mesh",
            event_type="chaos_injected",
            severity="CRITICAL",
            service=svc,
            message=f"Chaos experiment injected: {scen_name}",
            status="active",
            metadata={"scenario": scen_name}
        )
    except Exception:
        pass

    # Run the agent workflow in background
    background_tasks.add_task(orchestrate_agents, scen_name, fail_verif)
    return {"status": "sequence_started"}

async def orchestrate_agents(scenario: str = "payment_crash", fail_verification: bool = False):
    global current_system_state
    current_system_state = "anomaly"
    try:
        result = await incident_orchestrator.run_autonomous_workflow(scenario, will_fail_verification=fail_verification)
        if result.get("status") == "rule_disabled":
            current_system_state = "healthy"
        elif result.get("mode") == "APPROVAL_REQUIRED":
            current_system_state = "awaiting_approval"
        elif result.get("verified") is False:
            current_system_state = "anomaly"
        else:
            current_system_state = "healthy"
    except Exception as e:
        add_log("System", "Error", f"Error in autonomous workflow: {str(e)}")
        current_system_state = "anomaly"

# ==========================================
# AUTONOMOUS INCIDENT & POLICY APIS
# ==========================================

@app.post("/api/alarms/{alarm_id}/approve")
async def approve_alarm(alarm_id: int, req: ApprovalRequest):
    """Admin approves the proposed remediation action."""
    global current_system_state
    current_system_state = "remediation"
    res = await incident_orchestrator.approve_incident(alarm_id, req.approved_by)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    current_system_state = "healthy"
    return res

@app.post("/api/alarms/{alarm_id}/reject")
async def reject_alarm(alarm_id: int, req: RejectionRequest):
    """Admin rejects the proposed remediation action."""
    global current_system_state
    res = await incident_orchestrator.reject_incident(alarm_id, req.rejected_by, req.reason)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    
    # If no other alarms are awaiting approval, return state to healthy
    active_approvals = alarm_engine.query_alarms(status="awaiting_approval")
    if not active_approvals:
        current_system_state = "healthy"

    return res

@app.get("/api/policies")
async def get_policies():
    """Returns all guardrail/policy rules."""
    return policy_engine.get_policies()

@app.put("/api/policies/{action_type}")
async def update_policy(action_type: str, policy_update: PolicyUpdateModel):
    """Updates a guardrail policy (allows admin to configure/approve policy rules)."""
    updated = policy_engine.update_policy(action_type, policy_update.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Policy not found")
    return updated

@app.get("/api/incidents")
async def get_incidents(limit: int = Query(50, ge=1, le=200)):
    """Returns autonomous incident decision records."""
    return incident_orchestrator.list_incidents(limit=limit)

@app.get("/api/autonomy/summary")
async def get_autonomy_summary():
    """Returns dynamic operational stats and recent concise autonomous operations."""
    incidents = incident_orchestrator.list_incidents(limit=100)
    active_alarms = alarm_engine.query_alarms(status="active")
    
    auto_healed = sum(1 for inc in incidents if inc.get("status") == "RESOLVED" and inc.get("execution_mode") in ["AUTO", "AUTO_NOTIFY"])
    awaiting_approval = sum(1 for a in active_alarms if a.get("state") == "AWAITING_APPROVAL")
    active_incidents = len(active_alarms)
    verification_failures = sum(1 for inc in incidents if inc.get("status") in ["FAILED", "ESCALATED"] or "failed" in (inc.get("verification_result") or "").lower())
    successful_remediations = sum(1 for inc in incidents if inc.get("status") == "RESOLVED" and inc.get("execution_result"))
    
    # Recent agent operations (clean feed, no heartbeat noise)
    events_res = history_service.query_events(page=1, page_size=30)
    agent_sources = {"MonitoringAgent", "AnalysisAgent", "RCAAgent", "RemediationAgent", "DeploymentAgent", "PolicyEngine", "System", "Admin"}
    recent_ops = []
    for ev in events_res.get("events", []):
        src = ev.get("source", "")
        if src in agent_sources or "agent" in src.lower() or ev.get("event_type") in ["verification_failed", "incident_escalated", "incident_resolved", "action_approved", "action_rejected", "action_executed"]:
            recent_ops.append({
                "id": ev.get("id"),
                "timestamp": ev.get("timestamp"),
                "source": src,
                "service": ev.get("service"),
                "event_type": ev.get("event_type"),
                "severity": ev.get("severity"),
                "message": ev.get("message"),
                "status": ev.get("status")
            })
            if len(recent_ops) >= 12:
                break

    return {
        "auto_healed_today": auto_healed,
        "awaiting_approval": awaiting_approval,
        "active_incidents": active_incidents,
        "verification_failures": verification_failures,
        "successful_remediations": successful_remediations,
        "recent_ops": recent_ops
    }

@app.get("/api/incidents/{incident_id}")
async def get_incident(incident_id: str):
    """Returns details of a specific autonomous incident."""
    inc = incident_orchestrator.get_incident_by_id(incident_id)
    if not inc:
        raise HTTPException(status_code=404, detail="Incident not found")
    return inc

@app.get("/api/alarms/{alarm_id}/incident")
async def get_alarm_incident(alarm_id: int):
    """Returns the linked autonomous incident record for an alarm."""
    inc = incident_orchestrator.get_incident_by_alarm_id(alarm_id)
    if not inc:
        raise HTTPException(status_code=404, detail="No incident record linked to this alarm")
    return inc

# ==========================================
# HISTORY APIS
# ==========================================

@app.get("/api/history/events")
async def get_history_events(
    start_time: Optional[float] = Query(None, description="Start epoch seconds"),
    end_time: Optional[float] = Query(None, description="End epoch seconds"),
    service: Optional[str] = Query(None, description="Service filter or 'all'"),
    severity: Optional[str] = Query(None, description="Severity filter or 'all'"),
    event_type: Optional[str] = Query(None, description="Event type filter or 'all'"),
    status: Optional[str] = Query(None, description="Status filter or 'all'"),
    search: Optional[str] = Query(None, description="Keyword search in messages"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200)
):
    """
    Returns paginated event history with filtering by date range, service,
    severity, event type, status, and keyword search.
    """
    try:
        return history_service.query_events(
            start_time=start_time,
            end_time=end_time,
            service=service,
            severity=severity,
            event_type=event_type,
            status=status,
            search=search,
            page=page,
            page_size=page_size
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/metrics")
async def get_history_metrics(
    service: str = Query("paymentservice", description="Target microservice"),
    metric_name: str = Query("latency_p95_ms", description="Target metric name"),
    range: str = Query("1h", description="Preset range: 15m, 1h, 6h, 24h, 7d, 30d"),
    start_time: Optional[float] = Query(None, description="Custom start epoch seconds"),
    end_time: Optional[float] = Query(None, description="Custom end epoch seconds"),
    target_points: int = Query(120, ge=10, le=500, description="Points target for downsampling")
):
    """
    Returns downsampled historical metric data preserving min/max peaks.
    """
    try:
        return history_service.query_metrics_downsampled(
            service=service,
            metric_name=metric_name,
            time_range=range,
            custom_start=start_time,
            custom_end=end_time,
            target_points=target_points
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/history/services")
async def get_history_services():
    """Returns available services, metrics, and event types for dropdown filters."""
    try:
        return history_service.get_services_and_metrics()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# ALARM APIS
# ==========================================

@app.get("/api/alarms")
async def get_alarms(
    status: Optional[str] = Query("all", description="'active', 'resolved', or 'all'"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    service: Optional[str] = Query(None, description="Filter by service"),
    limit: int = Query(50, ge=1, le=200)
):
    """Returns active and historical alarm instances."""
    try:
        return alarm_engine.query_alarms(
            status=status,
            severity=severity,
            service=service,
            limit=limit
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/alarms/{alarm_id}")
async def get_alarm(alarm_id: int):
    """Returns details and state transition audit log for an alarm."""
    alarm = alarm_engine.get_alarm_details(alarm_id)
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return alarm

@app.get("/api/alarms/{alarm_id}/correlation")
async def get_alarm_correlation(alarm_id: int):
    """
    Returns incident correlation data: metric series focused on the alarm period
    plus related chronological events.
    """
    correlation = alarm_engine.get_alarm_correlation(alarm_id)
    if not correlation:
        raise HTTPException(status_code=404, detail="Alarm not found")
    return correlation

@app.post("/api/alarms/{alarm_id}/acknowledge")
async def acknowledge_alarm(alarm_id: int, req: AcknowledgeRequest):
    """Acknowledges an active firing alarm."""
    success = alarm_engine.acknowledge_alarm(alarm_id, req.acknowledged_by, req.note)
    if not success:
        raise HTTPException(status_code=400, detail="Alarm could not be acknowledged (may already be acknowledged or resolved).")
    return {"status": "acknowledged", "alarm_id": alarm_id}

@app.post("/api/alarms/{alarm_id}/resolve")
async def resolve_alarm(alarm_id: int, req: ResolveRequest):
    """Manually resolves an active alarm."""
    success = alarm_engine.resolve_alarm_manually(alarm_id, req.resolution_reason)
    if not success:
        raise HTTPException(status_code=400, detail="Alarm could not be resolved (may already be resolved).")
    return {"status": "resolved", "alarm_id": alarm_id}

@app.get("/api/alarm-rules")
async def get_alarm_rules():
    """Returns all configured alarm rules."""
    try:
        return alarm_engine.get_rules()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/alarm-rules")
async def create_alarm_rule(rule: AlarmRuleModel):
    """Creates a new alarm rule."""
    try:
        created = alarm_engine.create_rule(rule.model_dump())
        return created
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/alarm-rules/{rule_id}")
async def update_alarm_rule(rule_id: str, rule: AlarmRuleModel):
    """Updates an existing alarm rule."""
    try:
        updated = alarm_engine.update_rule(rule_id, rule.model_dump())
        if not updated:
            raise HTTPException(status_code=404, detail="Alarm rule not found")
        return updated
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/alarm-rules/{rule_id}/toggle")
async def toggle_alarm_rule(rule_id: str):
    """Toggles enabled/disabled state of an alarm rule."""
    toggled = alarm_engine.toggle_rule(rule_id)
    if not toggled:
        raise HTTPException(status_code=404, detail="Alarm rule not found")
    return toggled

@app.delete("/api/alarm-rules/{rule_id}")
async def delete_alarm_rule(rule_id: str):
    """Deletes an alarm rule."""
    deleted = alarm_engine.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alarm rule not found")
    return {"status": "deleted", "rule_id": rule_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
