import React, { useState } from 'react';
import { Play, AlertOctagon, RotateCcw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const ChaosControls = ({ systemState, setSystemState }) => {
  const [triggering, setTriggering] = useState(false);

  const triggerFailure = async (scenario) => {
    if (systemState !== 'healthy') return;
    
    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE}/api/trigger_chaos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scenario: scenario })
      });
      if (res.ok) {
        setSystemState('anomaly');
      }
    } catch (err) {
      console.error("Failed to trigger chaos via backend.", err);
    }
    setTriggering(false);
  };

  const resetSystem = async () => {
    try {
      await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
    } catch (err) {
      console.error("Failed to reset backend.", err);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
      <button 
        style={{
          background: systemState === 'healthy' ? '#FEF2F2' : '#F3F4F6',
          color: systemState === 'healthy' ? '#DC2626' : '#9CA3AF',
          border: `1px solid ${systemState === 'healthy' ? '#FCA5A5' : 'transparent'}`,
          padding: '0.8rem 1.2rem',
          borderRadius: '8px',
          cursor: systemState === 'healthy' && !triggering ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600,
          transition: 'all 0.2s',
          boxShadow: 'none'
        }}
        onClick={() => triggerFailure('payment_crash')}
        disabled={systemState !== 'healthy' || triggering}
      >
        <AlertOctagon size={18} />
        {triggering ? "Injecting..." : "Crash Payment Service"}
      </button>

      <button 
        style={{
          background: systemState === 'healthy' ? '#FFFBEB' : '#F3F4F6',
          color: systemState === 'healthy' ? '#D97706' : '#9CA3AF',
          border: `1px solid ${systemState === 'healthy' ? '#FDE68A' : 'transparent'}`,
          padding: '0.8rem 1.2rem',
          borderRadius: '8px',
          cursor: systemState === 'healthy' && !triggering ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600,
          transition: 'all 0.2s',
          boxShadow: 'none'
        }}
        onClick={() => triggerFailure('frontend_spike')}
        disabled={systemState !== 'healthy' || triggering}
      >
        <AlertOctagon size={18} />
        {triggering ? "Injecting..." : "Frontend Traffic Spike"}
      </button>

      <button 
        style={{
          background: '#E8F5E9',
          color: '#16A34A',
          border: '1px solid #A7F3D0',
          padding: '0.8rem 1.2rem',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600,
        }}
        onClick={resetSystem}
      >
        <RotateCcw size={18} />
        Reset Demo
      </button>

      <div style={{ 
        flex: 1, 
        padding: '1rem',
        background: '#FAFAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem'
      }}>
         <h4 style={{ margin: 0, color: '#1F2937', fontSize: '0.9rem' }}>Demo Script Control</h4>
         <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280' }}>
           Clicking "Inject Failure" will initiate the automated AI RCA and auto-remediation demonstration pipeline directly calling the Python Backend.
         </p>
      </div>
    </div>
  );
};

export default ChaosControls;
