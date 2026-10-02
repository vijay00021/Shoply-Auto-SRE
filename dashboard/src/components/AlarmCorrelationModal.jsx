import React, { useState, useEffect } from 'react';
import ModalPortal from './ModalPortal';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import {
  X, Activity, Clock, ShieldAlert, GitCommit, CheckCircle2,
  AlertTriangle, Check, ShieldCheck, Cpu, FileText, Wrench
} from 'lucide-react';
import './AlarmCorrelationModal.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AlarmCorrelationModal = ({ alarmId, onClose }) => {
  const [correlationData, setCorrelationData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("Operation rejected by administrator");

  const loadData = () => {
    if (!alarmId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/alarms/${alarmId}/correlation`)
      .then(res => res.json())
      .then(data => {
        setCorrelationData(data);
      })
      .catch(err => console.error("Failed to load correlation packet:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [alarmId]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!alarmId) return null;

  const alarm = correlationData?.alarm;
  const incident = correlationData?.incident || alarm?.incident;
  const metricSeries = correlationData?.metric_series || [];
  const relatedEvents = correlationData?.related_events || [];

  const threshold = alarm?.threshold || 0;
  const isRecovered = alarm?.state === 'RESOLVED';

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alarms/${alarmId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'admin' })
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      console.error("Failed to approve alarm in modal:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alarms/${alarmId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected_by: 'admin', reason: rejectReason })
      });
      if (res.ok) {
        setShowRejectInput(false);
        loadData();
      }
    } catch (err) {
      console.error("Failed to reject alarm in modal:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const renderTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload;
      return (
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '0.5rem', fontSize: '0.8rem' }}>
          <div><strong>Value:</strong> {p.value}</div>
          <div style={{ color: '#6B7280', fontSize: '0.75rem' }}>
            {p.timestamp || (p.timestamp_epoch ? new Date(p.timestamp_epoch * 1000).toLocaleTimeString() : '')}
          </div>
        </div>
      );
    }
    return null;
  };

  // Rendered on document.body so the popup is always centered in the visible viewport,
  // regardless of any transformed/scrolling parent.
  return (
    <ModalPortal>
      <div className="correlation-modal-overlay" onClick={onClose}>
        <div className="correlation-modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="correlation-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div className="brand-logo" style={{ padding: '0.4rem' }}>
                <Activity color="var(--accent-cyan)" size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                  Incident Detail & Autonomous SRE Drill-Down
                </h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Alarm #{alarmId} &bull; Service: {alarm?.service} &bull; {alarm?.rule_name || 'System Incident'}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
            >
              <X size={22} />
            </button>
          </div>

          {/* Content */}
          <div className="correlation-body">
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading correlation telemetry and autonomous incident details...
              </div>
            ) : !alarm ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Alarm not found.
              </div>
            ) : (
              <>
                {/* Human Approval Action Bar if AWAITING_APPROVAL */}
                {alarm.state === 'AWAITING_APPROVAL' && (
                  <div className="approval-action-bar">
                    <div>
                      <div style={{ fontWeight: 700, color: '#6D28D9', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                        <AlertTriangle size={18} color="#7C3AED" />
                        Human Approval Gate Active
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#4B5563', marginTop: '0.2rem' }}>
                        The Policy Engine blocked autonomous execution for proposed action <strong>{incident?.action_type || 'Remediation'}</strong>. Please authorize or reject.
                      </div>
                    </div>

                    {showRejectInput ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Rejection reason..."
                          style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                        />
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', color: '#DC2626', borderColor: '#FCA5A5' }}
                          onClick={handleReject}
                          disabled={actionLoading}
                        >
                          Confirm Reject (Do Not Execute)
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          onClick={() => setShowRejectInput(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button
                          className="btn-primary"
                          style={{ background: '#16A34A', borderColor: '#16A34A', padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={handleApprove}
                          disabled={actionLoading}
                        >
                          <Check size={15} /> {actionLoading ? "Executing..." : "Authorize & Execute"}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ color: '#DC2626', borderColor: '#FCA5A5', padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                          onClick={() => setShowRejectInput(true)}
                          disabled={actionLoading}
                        >
                          <X size={15} /> Reject Action
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Notice if REJECTED */}
                {alarm.state === 'REJECTED' && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.8rem 1rem', fontSize: '0.85rem', color: '#991B1B' }}>
                    <strong>ACTION REJECTED:</strong> The proposed remediation was rejected by an administrator. The action was <strong>NOT</strong> executed, and the system was preserved for human investigation.
                  </div>
                )}

                {/* Incident Details Strip: Clearly distinguishes Trigger Value vs Current Value */}
                <div className="incident-summary-strip">
                  <div className="incident-summary-item">
                    <span className="incident-summary-label">Target Service</span>
                    <span className="incident-summary-val" style={{ fontFamily: 'monospace' }}>{alarm.service}</span>
                  </div>
                  <div className="incident-summary-item">
                    <span className="incident-summary-label">Metric</span>
                    <span className="incident-summary-val">{alarm.metric}</span>
                  </div>
                  <div className="incident-summary-item">
                    <span className="incident-summary-label">Trigger Value</span>
                    <span className="incident-summary-val" style={{ color: '#DC2626', fontFamily: 'monospace' }}>
                      {alarm.trigger_value} <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>(Caused Incident)</span>
                    </span>
                  </div>
                  <div className="incident-summary-item">
                    <span className="incident-summary-label">Current Value</span>
                    <span className="incident-summary-val" style={{ color: isRecovered ? '#16A34A' : '#D97706', fontFamily: 'monospace' }}>
                      {alarm.current_value !== null ? alarm.current_value : '—'} <span style={{ fontSize: '0.72rem', color: '#6B7280' }}>(Latest Observation)</span>
                    </span>
                  </div>
                  <div className="incident-summary-item">
                    <span className="incident-summary-label">Status</span>
                    <span className={`status-tag status-${alarm.state.toLowerCase()}`}>
                      {alarm.state}
                    </span>
                  </div>
                  <div className="incident-summary-item">
                    <span className="incident-summary-label">Detected At</span>
                    <span className="incident-summary-val">
                      {new Date(alarm.started_at_epoch * 1000).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Five Agents Findings & RCA */}
                {incident && (
                  <div>
                    <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Cpu size={16} color="var(--accent-cyan)" />
                      Five Agent Investigation & Autonomous RCA
                    </h4>
                    <div className="agent-findings-grid">
                      <div className="agent-finding-item">
                        <span className="agent-finding-title">1. Monitoring Agent</span>
                        <span className="agent-finding-val">Anomaly detected ({alarm.metric} = {alarm.trigger_value})</span>
                      </div>
                      <div className="agent-finding-item">
                        <span className="agent-finding-title">2. Analysis Agent</span>
                        <span className="agent-finding-val">Isolated impacted service: {incident.service}</span>
                      </div>
                      <div className="agent-finding-item">
                        <span className="agent-finding-title">3. RCA Agent Diagnosis</span>
                        <span className="agent-finding-val" style={{ fontWeight: 600 }}>{incident.diagnosis || 'Service degradation'}</span>
                      </div>
                      <div className="agent-finding-item">
                        <span className="agent-finding-title">4. Proposed Remediation</span>
                        <span className="agent-finding-val" style={{ fontFamily: 'monospace' }}>
                          {incident.proposed_action?.action || incident.action_type}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Policy Engine Guardrail Card */}
                {incident && (
                  <div className={`guardrail-card ${incident.risk_level === 'HIGH' ? 'blocked' : 'auto'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldCheck size={18} color={incident.risk_level === 'HIGH' ? '#DC2626' : '#16A34A'} />
                        <strong style={{ fontSize: '0.92rem' }}>Policy / Guardrail Layer Evaluation</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: incident.risk_level === 'HIGH' ? '#FEE2E2' : incident.risk_level === 'MEDIUM' ? '#FEF3C7' : '#E8F5E9',
                          color: incident.risk_level === 'HIGH' ? '#DC2626' : incident.risk_level === 'MEDIUM' ? '#D97706' : '#16A34A'
                        }}>
                          RISK: {incident.risk_level}
                        </span>
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          background: '#F3F4F6',
                          color: '#4B5563'
                        }}>
                          MODE: {incident.execution_mode}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      <strong>Policy Decision:</strong> {incident.policy_result}
                    </div>
                    {incident.verification_result && (
                      <div style={{ fontSize: '0.85rem', color: incident.status === 'FAILED' ? '#DC2626' : '#166534', fontWeight: 500 }}>
                        <strong>Verification Result:</strong> {incident.verification_result}
                      </div>
                    )}
                  </div>
                )}

                {/* Focused Metric Time Series */}
                <div>
                  <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                    Metric Timeline Focused Around Incident Window ({alarm.metric})
                  </h4>
                  <div className="correlation-chart-box">
                    {metricSeries.length === 0 ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
                        No metric points available in incident timeframe.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metricSeries} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="incidentGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isRecovered ? '#22C55E' : '#DC2626'} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={isRecovered ? '#22C55E' : '#DC2626'} stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                          <XAxis dataKey="timestamp" hide />
                          <YAxis stroke="#9CA3AF" fontSize={11} />
                          <Tooltip content={renderTooltip} />
                          <ReferenceLine
                            y={threshold}
                            stroke="#DC2626"
                            strokeDasharray="4 4"
                            label={{ value: `Threshold: ${threshold}`, fill: '#DC2626', fontSize: 10 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={isRecovered ? '#22C55E' : '#DC2626'}
                            strokeWidth={2}
                            fill="url(#incidentGrad)"
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Chronological Related Events (Phase 10 & 12) */}
                <div className="timeline-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      Related Events in Incident Window
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Chronological correlation (chaos, agent actions, transitions)
                    </span>
                  </div>

                  <div className="timeline-list">
                    {relatedEvents.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No related events detected in this timeframe.
                      </div>
                    ) : (
                      relatedEvents.map((ev) => (
                        <div key={ev.id} className={`timeline-item sev-${ev.severity}`}>
                          <span className="timeline-dot"></span>
                          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                            <span className="timeline-time">
                              {new Date(ev.timestamp_epoch * 1000).toLocaleTimeString()}
                            </span>
                            <span className="event-type-badge">{ev.event_type}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              [{ev.source}]
                            </span>
                          </div>
                          <div className="timeline-msg">
                            {ev.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* State Transition History */}
                {alarm.transitions && alarm.transitions.length > 0 && (
                  <div>
                    <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      Alarm State Transition Audit Trail
                    </h4>
                    <div style={{ background: '#FFFFFF', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#F9FAFB', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', color: '#6B7280' }}>Time</th>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', color: '#6B7280' }}>Transition</th>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', color: '#6B7280' }}>Reason / Note</th>
                            <th style={{ padding: '0.6rem 1rem', textAlign: 'left', color: '#6B7280' }}>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {alarm.transitions.map((t) => (
                            <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.6rem 1rem', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                {new Date(t.timestamp_epoch * 1000).toLocaleTimeString()}
                              </td>
                              <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>
                                {t.from_state} &rarr; {t.to_state}
                              </td>
                              <td style={{ padding: '0.6rem 1rem' }}>{t.reason || '—'}</td>
                              <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace' }}>
                                {t.value !== null ? t.value : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AlarmCorrelationModal;