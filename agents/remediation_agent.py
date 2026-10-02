# agents/remediation_agent.py

def determine_remediation(rca_output, scenario: str = ""):
    """
    Remediation Agent determines the fix based on RCA.
    Proposes an action with target and parameters for the Policy/Guardrail engine to evaluate.
    """
    issue = rca_output.get("root_cause", "").lower()
    scenario_str = (scenario or "").lower()

    # 1. Configuration Drift / Production Config Change (Risky Level 3)
    if "config" in issue or "config" in scenario_str:
        return {
            "action": "modify_production_config",
            "target": "configmap/payment-gateway-cfg",
            "params": {"timeout_seconds": 30, "connection_pool": 100},
            "message": "Proposed Remediation: Modify production gateway configuration (High Impact Config Change).",
            "expected_impact": "Updates live production timeouts and connection pool parameters.",
            "risk_rationale": "Direct production configuration mutation requires administrator approval."
        }

    # 2. Database Schema Change (Risky Level 3)
    if "schema" in issue or "schema" in scenario_str:
        return {
            "action": "database_schema_change",
            "target": "database/payment-db-main",
            "params": {"migration_script": "V2__add_index_and_partition.sql"},
            "message": "Proposed Remediation: Apply live database index migration.",
            "expected_impact": "Locks payment table temporarily during schema index creation.",
            "risk_rationale": "Irreversible database structural change requires human sign-off."
        }

    # 3. Pod Failure / Crash (Safe Level 1)
    if "pod crash" in issue or "pod failure" in issue or "oom" in issue or "payment_crash" in scenario_str or "crash" in scenario_str:
        return {
            "action": "restart_pod",
            "target": "deployment/payment-db",
            "params": {"grace_period": 10},
            "message": "Executing Auto-Remediation: Restarting DB pod...",
            "expected_impact": "Performs rolling pod restart to clear stuck database connection.",
            "risk_rationale": "Safe, reversible, and pre-approved rolling restart."
        }

    # 4. Cache Invalidation / Stale Cache Clear (Safe Level 1)
    if "cache" in issue or "cache" in scenario_str:
        return {
            "action": "clear_cache",
            "target": "cache/redis-cluster",
            "params": {"service": "frontend"},
            "message": "Executing Auto-Remediation: Flushing stale cache entries...",
            "expected_impact": "Clears degraded memory keys and triggers cold refresh.",
            "risk_rationale": "Safe and reversible memory eviction."
        }

    # 5. Traffic Surge / Scaling
    if "traffic" in issue or "latency" in issue or "spike" in scenario_str or "traffic" in scenario_str:
        # If scenario specifies massive surge, request 8 replicas (exceeds policy limit of 3 -> Level 3 Approval)
        # If scenario is normal surge, request 3 replicas (within safe policy limit -> Level 2 Auto + Notify)
        if "massive" in scenario_str or "unapproved" in scenario_str or "risky" in scenario_str:
            return {
                "action": "scale_deployment",
                "target": "deployment/payment",
                "replicas": 8,
                "message": "Proposed Remediation: Scale payment service to 8 replicas (Exceeds Policy Limit).",
                "expected_impact": "Provisions 8 pods on Kubernetes cluster, increasing compute consumption.",
                "risk_rationale": "Requested replicas (8) exceeds safe limit (3). Requires administrator approval."
            }
        else:
            return {
                "action": "scale_deployment",
                "target": "deployment/frontend",
                "replicas": 3,
                "message": "Executing Auto-Remediation: Scaling frontend service to 3 replicas (Pre-approved limit)...",
                "expected_impact": "Adds 2 frontend pod replicas to absorb traffic surge.",
                "risk_rationale": "Pre-approved safe scaling within limit. Auto-executing and notifying admin."
            }
        
    return {
        "action": "alert_only",
        "target": "system/paging",
        "message": "Issue unknown. Paging human-in-the-loop.",
        "expected_impact": "No automatic remediation proposed.",
        "risk_rationale": "No matching remediation strategy."
    }
