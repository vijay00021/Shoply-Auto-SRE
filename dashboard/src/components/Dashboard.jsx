import React, { useState, useEffect } from 'react';
import './Dashboard.css';
import { Activity, Server, ShieldAlert, Bot } from 'lucide-react';
import AgentTerminal from './AgentTerminal';
import TopologyMap from './TopologyMap';
import ChaosControls from './ChaosControls';
import AutonomyStatus from './AutonomyStatus';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Dashboard = () => {
  const [systemState, setSystemState] = useState('healthy'); // healthy, anomaly, rca, remediation, recovering
  const [logs, setLogs] = useState([]);
  const [failingNode, setFailingNode] = useState(null);

  // Poll backend for system status and logs
  useEffect(() => {
    const pollBackend = async () => {
      try {
        const [statusRes, metricsRes] = await Promise.all([
          fetch(`${API_BASE}/api/status`),
          fetch(`${API_BASE}/api/metrics`)
        ]);
        
        if (statusRes.ok) {
          const data = await statusRes.json();
          setSystemState(data.system_state);
          setLogs(data.logs);
          if (data.system_state === 'healthy') {
            setFailingNode(null);
          }
        }
        
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          
          setFailingNode(prev => {
            if (metricsData['paymentservice']?.error_rate > 50) return 'payment';
            if (metricsData['frontend']?.error_rate > 15) return 'frontend';
            return prev;
          });
        }
      } catch (error) {
        console.error("Backend not reachable. Ensure FastAPI is running on port 8000.");
      }
    };

    const intervalId = setInterval(pollBackend, 2000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="dashboard-root">
      {/* Top Header */}
      <header className="dashboard-header animate-fade-in">
        <div className="header-brand">
          <div className="brand-logo">
            <Activity color="var(--accent-cyan)" size={28} />
          </div>
          <div>
            <h1>AutoSRE</h1>
            <span className="brand-subtitle">AI-Driven Multi-Agent DevOps System</span>
          </div>
        </div>
        
        <div className="header-status">
          <div className={`status-indicator status-${systemState}`}>
            <span className="pulse-dot"></span>
            System Status: {systemState.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="dashboard-grid">
        {/* Left Column: Topology & Autonomy Status */}
        <div className="grid-left">
          <section className="panel-card topology-panel">
            <div className="panel-header">
              <Server size={18} />
              <h2>Microservices Topology</h2>
            </div>
            <div className="panel-content">
              <TopologyMap systemState={systemState} failingNode={failingNode} />
            </div>
          </section>

          <section className="panel-card autonomy-status-panel">
            <div className="panel-header">
              <Activity size={18} />
              <h2>Autonomy Status & Health</h2>
            </div>
            <div className="panel-content">
              <AutonomyStatus />
            </div>
          </section>
        </div>

        {/* Right Column: AI Agents & Controls */}
        <div className="grid-right">
          <section className="panel-card controls-panel">
            <div className="panel-header">
              <ShieldAlert size={18} />
              <h2>Chaos Engineering & Demo Controls</h2>
            </div>
            <div className="panel-content">
              <ChaosControls 
                systemState={systemState} 
                setSystemState={setSystemState}
              />
            </div>
          </section>

          <section className="panel-card terminal-panel">
            <div className="panel-header">
              <Bot size={18} />
              <h2>Autonomous Operations</h2>
            </div>
            <div className="panel-content">
              <AgentTerminal logs={logs} systemState={systemState} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
