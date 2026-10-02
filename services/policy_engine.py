import time
from typing import Dict, List, Optional, Any
from services.database import get_db_connection, init_db
from services.history_service import current_iso_time

DEFAULT_POLICIES = [
    {
        "id": "pol_restart_pod",
        "action_type": "restart_pod",
        "risk_level": "LOW",
        "auto_allowed": 1,
        "notify_required": 0,
        "approval_required": 0,
        "max_limit": None,
        "enabled": 1,
        "description": "Autonomous restart of unhealthy microservice pods (Safe, Reversible, Pre-approved)."
    },
    {
        "id": "pol_clear_cache",
        "action_type": "clear_cache",
        "risk_level": "LOW",
        "auto_allowed": 1,
        "notify_required": 0,
        "approval_required": 0,
        "max_limit": None,
        "enabled": 1,
        "description": "Flushing stale in-memory or Redis caches for degraded services."
    },
    {
        "id": "pol_retry_job",
        "action_type": "retry_job",
        "risk_level": "LOW",
        "auto_allowed": 1,
        "notify_required": 0,
        "approval_required": 0,
        "max_limit": None,
        "enabled": 1,
        "description": "Retrying failed background jobs or dead-letter queue consumer tasks."
    },
    {
        "id": "pol_scale_deployment",
        "action_type": "scale_deployment",
        "risk_level": "MEDIUM",
        "auto_allowed": 1,
        "notify_required": 1,
        "approval_required": 0,
        "max_limit": 3.0,
        "enabled": 1,
        "description": "Autonomous scaling within safe limit (up to 3 replicas). Notifies admin. Exceeding 3 replicas requires approval."
    },
    {
        "id": "pol_modify_config",
        "action_type": "modify_production_config",
        "risk_level": "HIGH",
        "auto_allowed": 0,
        "notify_required": 1,
        "approval_required": 1,
        "max_limit": None,
        "enabled": 1,
        "description": "Production configuration or environment variable changes. High risk; requires human approval."
    },
    {
        "id": "pol_schema_change",
        "action_type": "database_schema_change",
        "risk_level": "HIGH",
        "auto_allowed": 0,
        "notify_required": 1,
        "approval_required": 1,
        "max_limit": None,
        "enabled": 1,
        "description": "Structural database schema alterations or migrations. Irreversible; requires human approval."
    },
    {
        "id": "pol_delete_resource",
        "action_type": "delete_resource",
        "risk_level": "HIGH",
        "auto_allowed": 0,
        "notify_required": 1,
        "approval_required": 1,
        "max_limit": None,
        "enabled": 1,
        "description": "Destructive deletion of infrastructure resources or persistent storage."
    }
]

class PolicyEngine:
    def __init__(self):
        self.init_policies()

    def init_policies(self):
        """Seeds default guardrail policies into the database if not already present."""
        init_db()
        now_str, _ = current_iso_time()
        with get_db_connection() as conn:
            cursor = conn.cursor()
            for p in DEFAULT_POLICIES:
                cursor.execute("SELECT id FROM policies WHERE action_type = ?", (p["action_type"],))
                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO policies (
                            id, action_type, risk_level, auto_allowed, notify_required,
                            approval_required, max_limit, enabled, description, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        p["id"], p["action_type"], p["risk_level"], p["auto_allowed"],
                        p["notify_required"], p["approval_required"], p["max_limit"],
                        p["enabled"], p["description"], now_str, now_str
                    ))

    def get_policies(self) -> List[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM policies ORDER BY created_at ASC")
            return [dict(row) for row in cursor.fetchall()]

    def get_policy(self, action_type: str) -> Optional[Dict[str, Any]]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM policies WHERE action_type = ?", (action_type,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def update_policy(self, action_type: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now_str, _ = current_iso_time()
        policy = self.get_policy(action_type)
        if not policy:
            return None

        auto_allowed = updates.get("auto_allowed", policy["auto_allowed"])
        notify_required = updates.get("notify_required", policy["notify_required"])
        approval_required = updates.get("approval_required", policy["approval_required"])
        max_limit = updates.get("max_limit", policy["max_limit"])
        enabled = updates.get("enabled", policy["enabled"])
        description = updates.get("description", policy["description"])
        risk_level = updates.get("risk_level", policy["risk_level"])

        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE policies SET
                    risk_level = ?, auto_allowed = ?, notify_required = ?,
                    approval_required = ?, max_limit = ?, enabled = ?,
                    description = ?, updated_at = ?
                WHERE action_type = ?
            """, (
                risk_level, int(auto_allowed), int(notify_required),
                int(approval_required), float(max_limit) if max_limit is not None else None,
                int(enabled), description, now_str, action_type
            ))
        return self.get_policy(action_type)

    def evaluate_action(self, action_proposal: Dict[str, Any]) -> Dict[str, Any]:
        """
        Policy/Guardrail Engine:
        Evaluates a proposed action independently of the agents.
        AGENTS CANNOT SELF-APPROVE RESTRICTED ACTIONS.
        
        Returns:
            {
                "allowed": bool,
                "mode": "AUTO" | "AUTO_NOTIFY" | "APPROVAL_REQUIRED",
                "risk_level": "LOW" | "MEDIUM" | "HIGH",
                "reason": str,
                "policy": Dict,
                "blocked_by_policy": bool
            }
        """
        action_type = action_proposal.get("action", "unknown")
        policy = self.get_policy(action_type)

        # Fallback: If action is completely unknown or undefined, block it safely
        if not policy:
            return {
                "allowed": False,
                "mode": "APPROVAL_REQUIRED",
                "risk_level": "HIGH",
                "reason": f"Action '{action_type}' is unclassified or unregistered. Human approval required for safety.",
                "policy": None,
                "blocked_by_policy": True
            }

        # If policy is disabled
        if not policy["enabled"]:
            return {
                "allowed": False,
                "mode": "APPROVAL_REQUIRED",
                "risk_level": "HIGH",
                "reason": f"Policy for action '{action_type}' is currently disabled. Human approval required.",
                "policy": policy,
                "blocked_by_policy": True
            }

        # Check numeric limits (e.g. scale replicas limit)
        if policy["max_limit"] is not None:
            proposed_val = action_proposal.get("replicas") or action_proposal.get("limit") or action_proposal.get("value")
            if proposed_val is not None:
                try:
                    val_num = float(proposed_val)
                    if val_num > float(policy["max_limit"]):
                        return {
                            "allowed": False,
                            "mode": "APPROVAL_REQUIRED",
                            "risk_level": "HIGH",
                            "reason": f"Proposed value ({val_num}) exceeds pre-approved policy limit of {policy['max_limit']} for {action_type}. Human approval required.",
                            "policy": policy,
                            "blocked_by_policy": True
                        }
                except (ValueError, TypeError):
                    pass

        # Check explicit approval requirement
        if policy["approval_required"] or not policy["auto_allowed"]:
            return {
                "allowed": False,
                "mode": "APPROVAL_REQUIRED",
                "risk_level": policy["risk_level"],
                "reason": f"Action '{action_type}' is classified as {policy['risk_level']} risk and restricted by policy. Human approval required before execution.",
                "policy": policy,
                "blocked_by_policy": True
            }

        # Pre-approved safe action
        if policy["notify_required"]:
            return {
                "allowed": True,
                "mode": "AUTO_NOTIFY",
                "risk_level": policy["risk_level"],
                "reason": f"Action '{action_type}' is pre-approved within policy limits. Auto-execution allowed with admin notification.",
                "policy": policy,
                "blocked_by_policy": False
            }

        return {
            "allowed": True,
            "mode": "AUTO",
            "risk_level": policy["risk_level"],
            "reason": f"Action '{action_type}' is safe, reversible, and pre-approved by policy. Executing autonomously.",
            "policy": policy,
            "blocked_by_policy": False
        }

policy_engine = PolicyEngine()
