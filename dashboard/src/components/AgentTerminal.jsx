import React, { useEffect, useRef } from 'react';
import { Bot, CheckCircle2, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

const AGENT_LABELS = {
  'Monitoring': 'Monitoring Agent',
  'Analysis': 'Analysis Agent',
  'RCA': 'RCA Agent',
  'Remediation': 'Remediation Agent',
  'PolicyEngine': 'Policy Agent',
  'Deployment': 'Deployment Agent',
  'System': 'Verification Agent',
  'Admin': 'Administrator',
  'Chaos Mesh': 'Chaos Engine'
};

const AGENT_COLORS = {
  'Monitoring': { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD' },
  'Analysis': { bg: '#F3E8FF', text: '#7E22CE', border: '#E9D5FF' },
  'RCA': { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  'Remediation': { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  'PolicyEngine': { bg: '#CCFBF1', text: '#0F766E', border: '#99F6E4' },
  'Deployment': { bg: '#DCFCE7', text: '#15803D', border: '#BBF7D0' },
  'System': { bg: '#F1F5F9', text: '#334155', border: '#E2E8F0' },
  'Admin': { bg: '#FDF4FF', text: '#A21CAF', border: '#F5D0FE' },
  'Chaos Mesh': { bg: '#FEE2E2', text: '#B91C1C', border: '#FECACA' }
};

const AgentTerminal = ({ logs, systemState }) => {
  const terminalRef = useRef(null);

  // Filter out normal background heartbeats so only real autonomous events show
  const filteredLogs = (logs || []).filter(l => l.type !== 'HEARTBEAT');

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [filteredLogs]);

  return (
    <div style={{ 
      background: '#FAFAFB', 
      borderRadius: '8px', 
      padding: '0.85rem',
      height: '320px',
      overflowY: 'auto',
      border: '1px solid #E5E7EB',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }} ref={terminalRef}>
      
      {filteredLogs.length === 0 ? (
        <div style={{ color: '#6B7280', fontSize: '0.85rem', textAlign: 'center', margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <Bot size={28} color="#9CA3AF" />
          <span>Autonomous SRE agents standing by.</span>
          <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>All 5 agents initialized: Monitoring, Analysis, RCA, Remediation, Deployment.</span>
        </div>
      ) : (
        filteredLogs.map((log, i) => {
          const agentName = AGENT_LABELS[log.agent] || log.agent;
          const color = AGENT_COLORS[log.agent] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
          const isError = log.type === 'ERROR' || log.type === 'Verification Failed' || (log.message && log.message.includes('FAILED'));
          const isSuccess = log.type === 'Resolved' || (log.message && log.message.includes('RESOLVED'));

          return (
            <div 
              key={i} 
              className="animate-fade-in"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontSize: '0.82rem',
                padding: '0.45rem 0.6rem',
                background: '#FFFFFF',
                borderRadius: '6px',
                border: `1px solid ${isError ? '#FECACA' : isSuccess ? '#BBF7D0' : '#E5E7EB'}`,
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            >
              <span style={{ color: '#9CA3AF', fontSize: '0.75rem', fontFamily: 'monospace', whiteSpace: 'nowrap', paddingTop: '2px' }}>
                {log.timestamp}
              </span>

              <span style={{
                background: isError ? '#FEF2F2' : isSuccess ? '#F0FDF4' : color.bg,
                color: isError ? '#DC2626' : isSuccess ? '#16A34A' : color.text,
                border: `1px solid ${isError ? '#FCA5A5' : isSuccess ? '#A7F3D0' : color.border}`,
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }}>
                {agentName}
              </span>

              <span style={{ color: isError ? '#991B1B' : isSuccess ? '#166534' : '#1F2937', flex: 1, wordBreak: 'break-word', lineHeight: '1.35' }}>
                {log.message}
              </span>
            </div>
          );
        })
      )}

      {systemState !== 'healthy' && systemState !== 'recovering' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.4rem 0.6rem', background: '#F0FDF4', borderRadius: '6px', border: '1px solid #BBF7D0', marginTop: '0.2rem' }}>
          <span className="pulse-indicator" style={{ background: '#16A34A' }}></span>
          <span style={{ color: '#166534', fontSize: '0.8rem', fontWeight: 500 }}>Autonomous agents active in diagnosis and remediation...</span>
        </div>
      )}
    </div>
  );
};

export default AgentTerminal;
