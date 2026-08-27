import React, { useEffect, useRef } from 'react';

const AgentTerminal = ({ logs, systemState }) => {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ 
      background: '#F9FAFB', 
      borderRadius: '8px', 
      padding: '1rem',
      height: '300px',
      overflowY: 'auto',
      border: '1px solid #E5E7EB',
      fontFamily: '"Fira Code", monospace',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }} ref={terminalRef}>
      
      {logs.length === 0 ? (
        <div style={{ color: '#71717A', fontStyle: 'italic', fontSize: '0.85rem' }}>
          [&gt;] Connection established...
          <br/>
          [&gt;] Agents standing by in IDLE state.
        </div>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="agent-log animate-fade-in">
            <span style={{ color: '#71717A', minWidth: '80px' }}>[{log.timestamp}]</span>
            <span className={`agent-name agent-${log.agent}`}>[{log.agent}]</span>
            <span style={{ color: '#1F2937' }}>{log.message}</span>
          </div>
        ))
      )}

      {systemState !== 'healthy' && systemState !== 'recovering' && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
          <span style={{ width: '8px', height: '16px', background: 'var(--accent-cyan)', animation: 'pulseGlow 1s infinite alternate' }}></span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Agent is thinking...</span>
        </div>
      )}
    </div>
  );
};

export default AgentTerminal;
