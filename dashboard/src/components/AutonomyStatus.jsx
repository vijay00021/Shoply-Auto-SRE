import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AutonomyStatus = () => {
  const [summary, setSummary] = useState({
    auto_healed_today: 0,
    awaiting_approval: 0,
    active_incidents: 0,
    verification_failures: 0,
    successful_remediations: 0
  });

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/autonomy/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error("Failed to fetch autonomy summary:", err);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
      <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#166534', textTransform: 'uppercase' }}>Auto-Healed</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#15803D' }}>{summary.auto_healed_today}</span>
        <span style={{ fontSize: '0.7rem', color: '#16A34A' }}>L1 & L2 safe healed</span>
      </div>

      <div style={{ background: summary.awaiting_approval > 0 ? '#FAF5FF' : '#F9FAFB', border: `1px solid ${summary.awaiting_approval > 0 ? '#DDD6FE' : '#E5E7EB'}`, borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: summary.awaiting_approval > 0 ? '#6D28D9' : '#6B7280', textTransform: 'uppercase' }}>Awaiting Approval</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: summary.awaiting_approval > 0 ? '#7C3AED' : '#4B5563' }}>{summary.awaiting_approval}</span>
        <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>L3 sign-off required</span>
      </div>

      <div style={{ background: summary.active_incidents > 0 ? '#FEF2F2' : '#F9FAFB', border: `1px solid ${summary.active_incidents > 0 ? '#FECACA' : '#E5E7EB'}`, borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: summary.active_incidents > 0 ? '#991B1B' : '#6B7280', textTransform: 'uppercase' }}>Active Incidents</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: summary.active_incidents > 0 ? '#DC2626' : '#16A34A' }}>{summary.active_incidents}</span>
        <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>Distinct alarms</span>
      </div>

      <div style={{ background: summary.verification_failures > 0 ? '#FFF1F2' : '#F9FAFB', border: `1px solid ${summary.verification_failures > 0 ? '#FECDD3' : '#E5E7EB'}`, borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: summary.verification_failures > 0 ? '#9F1239' : '#6B7280', textTransform: 'uppercase' }}>Verification Failures</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: summary.verification_failures > 0 ? '#BE123C' : '#6B7280' }}>{summary.verification_failures}</span>
        <span style={{ fontSize: '0.7rem', color: '#6B7280' }}>Escalated to human</span>
      </div>

      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#0369A1', textTransform: 'uppercase' }}>Successful Fixes</span>
        <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0284C7' }}>{summary.successful_remediations}</span>
        <span style={{ fontSize: '0.7rem', color: '#0369A1' }}>Recovery verified</span>
      </div>
    </div>
  );
};

export default AutonomyStatus;
