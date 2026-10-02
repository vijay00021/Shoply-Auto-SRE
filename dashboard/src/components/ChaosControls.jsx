import React, { useState } from 'react';
import { Play, AlertOctagon, RotateCcw, ShieldAlert, AlertTriangle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ChaosControls = ({ systemState, setSystemState }) => {
  const [triggering, setTriggering] = useState(false);

  const triggerFailure = async (scenario, failVerification = false) => {
    if (systemState !== 'healthy' || triggering) return;

    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/trigger_chaos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenario: scenario,
          fail_verification: failVerification
        })
      });
      if (res.ok) {
        setSystemState('anomaly');
      }
    } catch (err) {
      console.error("Failed to trigger chaos via backend.", err);
    } finally {
      setTriggering(false);
    }
  };

  const resetSystem = async () => {
    try {
      await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      setSystemState('healthy');
    } catch (err) {
      console.error("Failed to reset backend.", err);
    }
  };

  const isHealthy = systemState === 'healthy';

  return (
    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {/* Level 1: Safe Auto-Heal */}
      <button
        style={{
          background: isHealthy ? '#FEF2F2' : '#F3F4F6',
          color: isHealthy ? '#DC2626' : '#9CA3AF',
          border: `1px solid ${isHealthy ? '#FCA5A5' : 'transparent'}`,
          padding: '0.7rem 1rem',
          borderRadius: '8px',
          cursor: isHealthy && !triggering ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontWeight: 600,
          fontSize: '0.85rem',
          transition: 'all 0.2s',
          boxShadow: 'none'
        }}
        onClick={() => triggerFailure('payment_crash')}
        disabled={!isHealthy || triggering}
        title="Level 1 Autonomy: Safe pod restart executed automatically"
      >
        <AlertOctagon size={16} />
        {triggering ? "Injecting..." : "Crash Pod (L1 Auto-Heal)"}
      </button>

      {/* Level 2: Safe Auto-Heal + Notify */}
      <button
        style={{
          background: isHealthy ? '#FFFBEB' : '#F3F4F6',
          color: isHealthy ? '#D97706' : '#9CA3AF',
          border: `1px solid ${isHealthy ? '#FDE68A' : 'transparent'}`,
          padding: '0.7rem 1rem',
          borderRadius: '8px',
          cursor: isHealthy && !triggering ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontWeight: 600,
          fontSize: '0.85rem',
          transition: 'all 0.2s',
          boxShadow: 'none'
        }}
        onClick={() => triggerFailure('frontend_spike')}
        disabled={!isHealthy || triggering}
        title="Level 2 Autonomy: Scale within limits (3 replicas) and notify admin"
      >
        <AlertOctagon size={16} />
        {triggering ? "Injecting..." : "Traffic Spike (L2 Auto+Notify)"}
      </button>

      {/* Level 3: Risky - Approval Required */}
      <button
        style={{
          background: isHealthy ? '#F5F3FF' : '#F3F4F6',
          color: isHealthy ? '#7C3AED' : '#9CA3AF',
          border: `1px solid ${isHealthy ? '#DDD6FE' : 'transparent'}`,
          padding: '0.7rem 1rem',
          borderRadius: '8px',
          cursor: isHealthy && !triggering ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontWeight: 600,
          fontSize: '0.85rem',
          transition: 'all 0.2s',
          boxShadow: 'none'
        }}
        onClick={() => triggerFailure('production_config_drift')}
        disabled={!isHealthy || triggering}
        title="Level 3 Autonomy: Production config change halted until human approval"
      >
        <ShieldAlert size={16} />
        {triggering ? "Injecting..." : "Config Drift (L3 Approval Req)"}
      </button>

      {/* Verification Failure Scenario */}
      <button
        style={{
          background: isHealthy ? '#FFF1F2' : '#F3F4F6',
          color: isHealthy ? '#BE123C' : '#9CA3AF',
          border: `1px solid ${isHealthy ? '#FECDD3' : 'transparent'}`,
          padding: '0.7rem 1rem',
          borderRadius: '8px',
          cursor: isHealthy && !triggering ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontWeight: 600,
          fontSize: '0.85rem',
          transition: 'all 0.2s',
          boxShadow: 'none'
        }}
        onClick={() => triggerFailure('verification_failure', true)}
        disabled={!isHealthy || triggering}
        title="Simulate verification check failure after remediation with escalation"
      >
        <AlertTriangle size={16} />
        {triggering ? "Injecting..." : "Verification Failure Demo"}
      </button>

      {/* Reset System */}
      <button
        style={{
          background: '#E8F5E9',
          color: '#16A34A',
          border: '1px solid #A7F3D0',
          padding: '0.7rem 1rem',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          fontWeight: 600,
          fontSize: '0.85rem',
        }}
        onClick={resetSystem}
      >
        <RotateCcw size={16} />
        Reset Demo
      </button>

      <div style={{
        flex: 1,
        minWidth: '220px',
        padding: '0.7rem 1rem',
        background: '#FAFAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem'
      }}>
        <h4 style={{ margin: 0, color: '#1F2937', fontSize: '0.85rem', fontWeight: 600 }}>Autonomous SRE Scenarios</h4>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280', lineHeight: '1.25' }}>
          Select a scenario to trigger Multi-Agent RCA, Policy Engine guardrail check, and automated or human-approved resolution.
        </p>
      </div>
    </div>
  );
};

export default ChaosControls;
