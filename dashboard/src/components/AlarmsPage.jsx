import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, ShieldAlert, CheckCircle2,
  Clock, Plus, ToggleLeft, ToggleRight, Trash2, Activity, RefreshCw, X, Check
} from 'lucide-react';
import AlarmCorrelationModal from './AlarmCorrelationModal';
import './AlarmsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AlarmsPage = () => {
  const [activeTab, setActiveTab] = useState('alarms'); // 'alarms' or 'rules'

  // Alarms List State
  const [alarms, setAlarms] = useState([]);
  const [alarmFilterStatus, setAlarmFilterStatus] = useState('all');
  const [alarmFilterSeverity, setAlarmFilterSeverity] = useState('all');
  const [selectedCorrelationId, setSelectedCorrelationId] = useState(null);

  // Rules State
  const [rules, setRules] = useState([]);
  const [showCreateRuleModal, setShowCreateRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    target_service: 'paymentservice',
    metric: 'latency_p95_ms',
    operator: '>',
    threshold: 500,
    duration_seconds: 4,
    severity: 'WARNING',
    cooldown_seconds: 30,
    recovery_threshold: '',
    description: ''
  });

  // Action modals & popovers
  const [ackModalAlarm, setAckModalAlarm] = useState(null);
  const [ackOperator, setAckOperator] = useState('operator');
  const [ackNote, setAckNote] = useState('');

  const popoverRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const [resolveModalAlarm, setResolveModalAlarm] = useState(null);
  const [resolveTriggerEl, setResolveTriggerEl] = useState(null);
  const [resolveReason, setResolveReason] = useState('Mitigated and validated healthy');

  // Human Approval / Rejection Modals
  const [approveModalAlarm, setApproveModalAlarm] = useState(null);
  const [approveTriggerEl, setApproveTriggerEl] = useState(null);
  const [rejectModalAlarm, setRejectModalAlarm] = useState(null);
  const [rejectTriggerEl, setRejectTriggerEl] = useState(null);
  const [rejectReason, setRejectReason] = useState('Operation rejected by administrator');
  const [actionLoading, setActionLoading] = useState(false);

  // Load Alarms
  const fetchAlarms = async () => {
    try {
      const params = new URLSearchParams();
      if (alarmFilterStatus !== 'all') params.append('status', alarmFilterStatus);
      if (alarmFilterSeverity !== 'all') params.append('severity', alarmFilterSeverity);
      params.append('limit', '100');

      const res = await fetch(`${API_BASE}/api/alarms?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlarms(data || []);
      }
    } catch (err) {
      console.error("Error fetching alarms:", err);
    }
  };

  // Load Rules
  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/alarm-rules`);
      if (res.ok) {
        const data = await res.json();
        setRules(data || []);
      }
    } catch (err) {
      console.error("Error fetching alarm rules:", err);
    }
  };

  useEffect(() => {
    fetchAlarms();
    fetchRules();
  }, [alarmFilterStatus, alarmFilterSeverity]);

  // Periodic polling for active alarms (Phase 13: Realtime updates)
  useEffect(() => {
    const timer = setInterval(() => {
      fetchAlarms();
    }, 2500);
    return () => clearInterval(timer);
  }, [alarmFilterStatus, alarmFilterSeverity]);

  const calculatePopoverPosition = (triggerEl, popoverEl, defaultWidth, defaultHeight) => {
    if (!triggerEl) return { top: 0, left: 0 };
    const triggerRect = triggerEl.getBoundingClientRect();
    const gap = 8;
    const padding = 16;

    let popupWidth = defaultWidth;
    let popupHeight = defaultHeight;

    if (popoverEl) {
      const popupRect = popoverEl.getBoundingClientRect();
      if (popupRect.width > 0) popupWidth = popupRect.width;
      if (popupRect.height > 0) popupHeight = popupRect.height;
    }

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

    const effectiveWidth = Math.min(popupWidth, viewportWidth - padding * 2);
    const effectiveHeight = Math.min(popupHeight, viewportHeight - padding * 2);

    // 1. Horizontal positioning:
    // If button is in the right half of viewport, or opening rightward would overflow:
    // Anchor popup right edge to trigger button right edge (opens toward the left)
    let left;
    if (triggerRect.right > viewportWidth / 2 || triggerRect.left + effectiveWidth > viewportWidth - padding) {
      left = triggerRect.right - effectiveWidth;
    } else {
      left = triggerRect.left;
    }

    // Strict boundary clamping
    left = Math.max(padding, Math.min(left, viewportWidth - effectiveWidth - padding));

    // 2. Vertical positioning:
    const spaceBelow = viewportHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;

    let top;
    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      top = triggerRect.top - effectiveHeight - gap;
    } else {
      top = triggerRect.bottom + gap;
    }

    top = Math.max(padding, Math.min(top, viewportHeight - effectiveHeight - padding));

    return {
      top: Math.round(top),
      left: Math.round(left)
    };
  };

  // Contextually anchor action confirmation popovers (Resolve, Authorize/Approve, Reject)
  // to the clicked trigger button and update on scroll/resize/content resize
  useLayoutEffect(() => {
    let triggerEl = null;
    let defaultWidth = 320;
    let defaultHeight = 220;

    if (approveModalAlarm && approveTriggerEl) {
      triggerEl = approveTriggerEl;
      defaultWidth = 460;
      defaultHeight = 420;
    } else if (resolveModalAlarm && resolveTriggerEl) {
      triggerEl = resolveTriggerEl;
      defaultWidth = 320;
      defaultHeight = 220;
    } else if (rejectModalAlarm && rejectTriggerEl) {
      triggerEl = rejectTriggerEl;
      defaultWidth = 380;
      defaultHeight = 260;
    }

    if (!triggerEl) return;

    const updatePosition = () => {
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();

      // If button scrolled out of viewport, safely close popover
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setApproveModalAlarm(null);
        setApproveTriggerEl(null);
        setResolveModalAlarm(null);
        setResolveTriggerEl(null);
        setRejectModalAlarm(null);
        setRejectTriggerEl(null);
        return;
      }

      const pos = calculatePopoverPosition(triggerEl, popoverRef.current, defaultWidth, defaultHeight);
      setPopoverPos(pos);
    };

    updatePosition();

    // Observe actual popup DOM element for dynamic content/size changes
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && popoverRef.current) {
      ro = new ResizeObserver(() => {
        updatePosition();
      });
      ro.observe(popoverRef.current);
    }

    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [approveTriggerEl, approveModalAlarm, resolveTriggerEl, resolveModalAlarm, rejectTriggerEl, rejectModalAlarm]);

  // Counts (Distinct active instances)
  const firingCount = alarms.filter(a => a.state === 'FIRING' || a.state === 'VERIFICATION_FAILED' || a.state === 'ESCALATED').length;
  const awaitingApprovalCount = alarms.filter(a => a.state === 'AWAITING_APPROVAL').length;
  const ackCount = alarms.filter(a => a.state === 'ACKNOWLEDGED').length;
  const resolvedCount = alarms.filter(a => a.state === 'RESOLVED').length;

  // Actions
  const handleAcknowledge = async () => {
    if (!ackModalAlarm) return;
    try {
      const res = await fetch(`${API_BASE}/api/alarms/${ackModalAlarm.id}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledged_by: ackOperator, note: ackNote })
      });
      if (res.ok) {
        setAckModalAlarm(null);
        setAckNote('');
        fetchAlarms();
      }
    } catch (err) {
      console.error("Failed to acknowledge alarm:", err);
    }
  };

  const handleResolve = async () => {
    if (!resolveModalAlarm) return;
    try {
      const res = await fetch(`${API_BASE}/api/alarms/${resolveModalAlarm.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_reason: resolveReason })
      });
      if (res.ok) {
        setResolveModalAlarm(null);
        setResolveTriggerEl(null);
        fetchAlarms();
      }
    } catch (err) {
      console.error("Failed to resolve alarm:", err);
    }
  };

  const handleApproveAction = async () => {
    if (!approveModalAlarm) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alarms/${approveModalAlarm.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'admin' })
      });
      if (res.ok) {
        setApproveModalAlarm(null);
        setApproveTriggerEl(null);
        fetchAlarms();
      }
    } catch (err) {
      console.error("Failed to approve action:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAction = async () => {
    if (!rejectModalAlarm) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/alarms/${rejectModalAlarm.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected_by: 'admin', reason: rejectReason })
      });
      if (res.ok) {
        setRejectModalAlarm(null);
        setRejectTriggerEl(null);
        fetchAlarms();
      }
    } catch (err) {
      console.error("Failed to reject action:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRule = async (ruleId) => {
    try {
      const res = await fetch(`${API_BASE}/api/alarm-rules/${ruleId}/toggle`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error("Failed to toggle rule:", err);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm(`Are you sure you want to delete rule ${ruleId}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/alarm-rules/${ruleId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error("Failed to delete rule:", err);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...newRule,
        threshold: parseFloat(newRule.threshold),
        duration_seconds: parseInt(newRule.duration_seconds, 10),
        cooldown_seconds: parseInt(newRule.cooldown_seconds, 10),
        recovery_threshold: newRule.recovery_threshold !== '' ? parseFloat(newRule.recovery_threshold) : null
      };

      const res = await fetch(`${API_BASE}/api/alarm-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowCreateRuleModal(false);
        setNewRule({
          name: '',
          target_service: 'paymentservice',
          metric: 'latency_p95_ms',
          operator: '>',
          threshold: 500,
          duration_seconds: 4,
          severity: 'WARNING',
          cooldown_seconds: 30,
          recovery_threshold: '',
          description: ''
        });
        fetchRules();
      }
    } catch (err) {
      console.error("Failed to create rule:", err);
    }
  };

  return (
    <div className="alarms-page-root animate-fade-in">
      {/* Header */}
      <header className="alarms-header">
        <div className="alarms-header-left">
          <div className="brand-logo">
            <Bell color="var(--accent-cyan)" size={28} />
          </div>
          <div>
            <h1>Alarms & Alert Management</h1>
            <span className="brand-subtitle">Sustained-condition alert engine, automated recovery, and incident correlation</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={() => { fetchAlarms(); fetchRules(); }}>
            <RefreshCw size={15} /> Refresh
          </button>
          {activeTab === 'rules' && (
            <button className="btn-primary" onClick={() => setShowCreateRuleModal(true)}>
              <Plus size={15} /> Create Alarm Rule
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="alarms-tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'alarms' ? 'active' : ''}`}
          onClick={() => setActiveTab('alarms')}
        >
          <Bell size={18} />
          <span>Alarms Stream</span>
          {firingCount > 0 && (
            <span className="tab-badge tab-badge-firing">{firingCount} Firing</span>
          )}
          {awaitingApprovalCount > 0 && (
            <span className="tab-badge" style={{ background: '#EDE9FE', color: '#7C3AED', marginLeft: '0.3rem' }}>
              {awaitingApprovalCount} Approval Req
            </span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <ShieldAlert size={18} />
          <span>Alarm Rules ({rules.length})</span>
        </button>
      </div>

      {activeTab === 'alarms' ? (
        <>
          {/* Summary KPIs */}
          <div className="alarm-summary-cards">
            <div className={`alarm-kpi-card ${firingCount > 0 ? 'kpi-firing' : ''}`}>
              <span className="alarm-kpi-title">Active Firing</span>
              <span className="alarm-kpi-val" style={{ color: firingCount > 0 ? '#DC2626' : '#16A34A' }}>
                {firingCount}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Requires attention</span>
            </div>

            <div className={`alarm-kpi-card ${awaitingApprovalCount > 0 ? 'kpi-approval' : ''}`}>
              <span className="alarm-kpi-title">Awaiting Approval</span>
              <span className="alarm-kpi-val" style={{ color: awaitingApprovalCount > 0 ? '#7C3AED' : '#6B7280' }}>
                {awaitingApprovalCount}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Human sign-off required</span>
            </div>

            <div className="alarm-kpi-card">
              <span className="alarm-kpi-title">Acknowledged</span>
              <span className="alarm-kpi-val" style={{ color: '#D97706' }}>
                {ackCount}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Being investigated</span>
            </div>

            <div className="alarm-kpi-card">
              <span className="alarm-kpi-title">Resolved History</span>
              <span className="alarm-kpi-val" style={{ color: '#16A34A' }}>
                {resolvedCount}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Recovered alarms</span>
            </div>

            <div className="alarm-kpi-card">
              <span className="alarm-kpi-title">Configured Rules</span>
              <span className="alarm-kpi-val" style={{ color: '#2563EB' }}>
                {rules.length}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Monitoring microservices</span>
            </div>
          </div>

          {/* Alarms List Panel */}
          <section className="panel-card" style={{ flex: 1 }}>
            <div className="panel-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Bell size={18} />
                <h2>Alarms Stream</h2>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <select
                  className="filter-select"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  value={alarmFilterStatus}
                  onChange={(e) => setAlarmFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active (Firing + Acknowledged + Approval)</option>
                  <option value="awaiting_approval">Awaiting Approval Only</option>
                  <option value="resolved">Resolved Only</option>
                </select>

                <select
                  className="filter-select"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  value={alarmFilterSeverity}
                  onChange={(e) => setAlarmFilterSeverity(e.target.value)}
                >
                  <option value="all">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="ERROR">Error</option>
                  <option value="WARNING">Warning</option>
                </select>
              </div>
            </div>

            <div className="panel-content">
              <div style={{ width: '100%', overflowX: 'auto' }}>
                <table className="alarms-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Severity</th>
                      <th>Service</th>
                      <th>Rule / Metric</th>
                      <th>Trigger Value</th>
                      <th>Current Value</th>
                      <th>Started At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alarms.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          No alarms found matching the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      alarms.map((alarm) => (
                        <tr key={alarm.id}>
                          <td>
                            <span className={`state-pill state-${alarm.state}`}>
                              {(alarm.state === 'FIRING' || alarm.state === 'AWAITING_APPROVAL' || alarm.state === 'VERIFICATION_FAILED' || alarm.state === 'ESCALATED') && <span className="pulse-indicator"></span>}
                              {alarm.state === 'AWAITING_APPROVAL' ? 'APPROVAL REQ' : alarm.state === 'VERIFICATION_FAILED' ? 'VERIF FAILED' : alarm.state}
                            </span>
                          </td>
                          <td>
                            <span className={`severity-badge severity-${alarm.severity}`}>
                              {alarm.severity}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                            {alarm.service}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                              {alarm.rule_name || alarm.rule_id}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {alarm.metric} ({alarm.operator} {alarm.threshold})
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {alarm.trigger_value}
                          </td>
                          <td style={{ fontFamily: 'monospace' }}>
                            {alarm.current_value !== null ? alarm.current_value : '—'}
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {new Date(alarm.started_at_epoch * 1000).toLocaleTimeString()}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {alarm.state === 'AWAITING_APPROVAL' && (
                                <>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#16A34A', borderColor: '#A7F3D0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                    onClick={(e) => {
                                      setResolveModalAlarm(null);
                                      setResolveTriggerEl(null);
                                      setRejectModalAlarm(null);
                                      setRejectTriggerEl(null);
                                      const pos = calculatePopoverPosition(e.currentTarget, null, 460, 420);
                                      setPopoverPos(pos);
                                      setApproveTriggerEl(e.currentTarget);
                                      setApproveModalAlarm(alarm);
                                    }}
                                    title="Authorize proposed remediation action"
                                  >
                                    <Check size={12} /> Approve
                                  </button>
                                  <button
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#DC2626', borderColor: '#FCA5A5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                    onClick={(e) => {
                                      setResolveModalAlarm(null);
                                      setResolveTriggerEl(null);
                                      setApproveModalAlarm(null);
                                      setApproveTriggerEl(null);
                                      const pos = calculatePopoverPosition(e.currentTarget, null, 380, 260);
                                      setPopoverPos(pos);
                                      setRejectTriggerEl(e.currentTarget);
                                      setRejectModalAlarm(alarm);
                                    }}
                                    title="Reject proposed remediation action"
                                  >
                                    <X size={12} /> Reject
                                  </button>
                                </>
                              )}
                              {alarm.state === 'FIRING' && (
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#D97706', borderColor: '#FDE68A' }}
                                  onClick={() => setAckModalAlarm(alarm)}
                                  title="Acknowledge alarm"
                                >
                                  Ack
                                </button>
                              )}
                              {alarm.state !== 'RESOLVED' && alarm.state !== 'AWAITING_APPROVAL' && (
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: '#16A34A', borderColor: '#A7F3D0' }}
                                  onClick={(e) => {
                                    setApproveModalAlarm(null);
                                    setApproveTriggerEl(null);
                                    setRejectModalAlarm(null);
                                    setRejectTriggerEl(null);
                                    const pos = calculatePopoverPosition(e.currentTarget, null, 320, 220);
                                    setPopoverPos(pos);
                                    setResolveTriggerEl(e.currentTarget);
                                    setResolveModalAlarm(alarm);
                                  }}
                                  title="Resolve alarm"
                                >
                                  Resolve
                                </button>
                              )}
                              <button
                                className="btn-secondary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                onClick={() => setSelectedCorrelationId(alarm.id)}
                                title="View focused graph and timeline correlation"
                              >
                                <Activity size={12} /> Incident Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* Tab 2: Rules Management */
        <section className="panel-card" style={{ flex: 1 }}>
          <div className="panel-header">
            <ShieldAlert size={18} />
            <h2>Configured Alarm Rules</h2>
          </div>
          <div className="panel-content">
            <div style={{ width: '100%', overflowX: 'auto' }}>
              <table className="alarms-table">
                <thead>
                  <tr>
                    <th>Rule Name</th>
                    <th>Target Service</th>
                    <th>Metric</th>
                    <th>Condition</th>
                    <th>Sustained For</th>
                    <th>Severity</th>
                    <th>Cooldown</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>
                        {r.name}
                        {r.description && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            {r.description}
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{r.target_service}</td>
                      <td style={{ fontFamily: 'monospace' }}>{r.metric}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {r.operator} {r.threshold}
                      </td>
                      <td>{r.duration_seconds}s</td>
                      <td>
                        <span className={`severity-badge severity-${r.severity}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td>{r.cooldown_seconds}s</td>
                      <td>
                        <button
                          onClick={() => handleToggleRule(r.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          {r.enabled ? (
                            <ToggleRight size={24} color="#16A34A" />
                          ) : (
                            <ToggleLeft size={24} color="#9CA3AF" />
                          )}
                          <span style={{ fontSize: '0.8rem', color: r.enabled ? '#16A34A' : '#9CA3AF', fontWeight: 600 }}>
                            {r.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => handleDeleteRule(r.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626' }}
                          title="Delete rule"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Acknowledge Modal */}
      {ackModalAlarm && (
        <div className="modal-overlay" onClick={() => setAckModalAlarm(null)}>
          <div className="modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Acknowledge Alarm #{ackModalAlarm.id}</h3>
              <button onClick={() => setAckModalAlarm(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                Acknowledging <strong>{ackModalAlarm.rule_name}</strong> on <strong>{ackModalAlarm.service}</strong>.
              </p>
              <div className="form-field">
                <label>Operator / Engineer Name</label>
                <input
                  type="text"
                  value={ackOperator}
                  onChange={(e) => setAckOperator(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label>Note / Triage Comment</label>
                <input
                  type="text"
                  placeholder="Investigating latency degradation..."
                  value={ackNote}
                  onChange={(e) => setAckNote(e.target.value)}
                />
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setAckModalAlarm(null)}>Cancel</button>
                <button className="btn-primary" onClick={handleAcknowledge}>Acknowledge</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contextually Anchored Resolve Popover */}
      {resolveModalAlarm && resolveTriggerEl && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'transparent' }}
            onClick={() => {
              setResolveModalAlarm(null);
              setResolveTriggerEl(null);
            }}
          />
          <div
            ref={popoverRef}
            className="resolve-popover-card animate-fade-in"
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              zIndex: 1000,
              width: '320px',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: 'calc(100vh - 24px)',
              boxSizing: 'border-box',
              overflowY: 'auto',
              background: '#FFFFFF',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #E5E7EB',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#1F2937' }}>
                <CheckCircle2 color="#16A34A" size={16} />
                <span>Confirm Resolution</span>
              </div>
              <button
                onClick={() => {
                  setResolveModalAlarm(null);
                  setResolveTriggerEl(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: '#4B5563', lineHeight: '1.4' }}>
              Are you sure you want to resolve alarm <strong>#{resolveModalAlarm.id}</strong> on <strong>{resolveModalAlarm.service}</strong>?
            </p>

            <div className="form-field" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.2rem', display: 'block' }}>Resolution Note</label>
              <input
                type="text"
                style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                value={resolveReason}
                onChange={(e) => setResolveReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.3rem' }}>
              <button
                className="btn-secondary"
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                onClick={() => {
                  setResolveModalAlarm(null);
                  setResolveTriggerEl(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: '#16A34A', borderColor: '#16A34A', padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
                onClick={() => {
                  handleResolve();
                  setResolveTriggerEl(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </>
      )}

      {/* Contextually Anchored Authorize / Approve Popover */}
      {approveModalAlarm && approveTriggerEl && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'transparent' }}
            onClick={() => {
              setApproveModalAlarm(null);
              setApproveTriggerEl(null);
            }}
          />
          <div
            ref={popoverRef}
            className="action-popover-card animate-fade-in"
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              zIndex: 1000,
              width: '460px',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: 'calc(100vh - 24px)',
              boxSizing: 'border-box',
              overflowY: 'auto',
              background: '#FFFFFF',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #E5E7EB',
              padding: '1.2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckCircle2 color="#16A34A" size={20} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Authorize Autonomous Remediation</h3>
              </div>
              <button
                onClick={() => {
                  setApproveModalAlarm(null);
                  setApproveTriggerEl(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '0.8rem 1rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '0.2rem' }}>Target Service & Alarm</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {approveModalAlarm.service} — {approveModalAlarm.rule_name || approveModalAlarm.metric}
                </div>
                {approveModalAlarm.action_type && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    <strong>Proposed Action:</strong> <span style={{ fontFamily: 'monospace' }}>{approveModalAlarm.action_type}</span>
                  </div>
                )}
                {approveModalAlarm.diagnosis && (
                  <div style={{ marginTop: '0.3rem', fontSize: '0.85rem', color: '#4B5563' }}>
                    <strong>Agent Diagnosis:</strong> {approveModalAlarm.diagnosis}
                  </div>
                )}
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.8rem 1rem', fontSize: '0.82rem', color: '#166534' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>What will happen if approved:</div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: '1.4' }}>
                  <li>Autonomous Deployment Agent will execute the remediation action.</li>
                  <li>System will monitor service recovery metrics before resolving.</li>
                  <li>Complete lifecycle will be documented in Event History.</li>
                </ul>
              </div>

              <div className="form-actions" style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setApproveModalAlarm(null);
                    setApproveTriggerEl(null);
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  style={{ background: '#16A34A', borderColor: '#16A34A' }}
                  onClick={async () => {
                    await handleApproveAction();
                    setApproveTriggerEl(null);
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Executing..." : "Authorize & Execute"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Contextually Anchored Reject Popover */}
      {rejectModalAlarm && rejectTriggerEl && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'transparent' }}
            onClick={() => {
              setRejectModalAlarm(null);
              setRejectTriggerEl(null);
            }}
          />
          <div
            ref={popoverRef}
            className="action-popover-card animate-fade-in"
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              zIndex: 1000,
              width: '380px',
              maxWidth: 'calc(100vw - 24px)',
              maxHeight: 'calc(100vh - 24px)',
              boxSizing: 'border-box',
              overflowY: 'auto',
              background: '#FFFFFF',
              borderRadius: '8px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1px solid #E5E7EB',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E7EB', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle color="#DC2626" size={18} />
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Reject Proposed Remediation</h3>
              </div>
              <button
                onClick={() => {
                  setRejectModalAlarm(null);
                  setRejectTriggerEl(null);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', padding: 0 }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151' }}>
                Rejecting remediation for <strong>{rejectModalAlarm.service}</strong> (#{rejectModalAlarm.id}).
              </p>

              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '0.7rem 0.9rem', fontSize: '0.8rem', color: '#991B1B' }}>
                <strong>CRITICAL SAFETY RULE:</strong> The proposed action will <strong>NOT</strong> execute. The incident will remain escalated in history for human engineer resolution.
              </div>

              <div className="form-field" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600 }}>Rejection Reason</label>
                <input
                  type="text"
                  style={{ width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.8rem', border: '1px solid #D1D5DB', borderRadius: '6px' }}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>

              <div className="form-actions" style={{ marginTop: '0.3rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                  onClick={() => {
                    setRejectModalAlarm(null);
                    setRejectTriggerEl(null);
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn-secondary"
                  style={{ color: '#DC2626', borderColor: '#FCA5A5', padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}
                  onClick={async () => {
                    await handleRejectAction();
                    setRejectTriggerEl(null);
                  }}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Rejecting..." : "Confirm Rejection (Do Not Execute)"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create Rule Modal */}
      {showCreateRuleModal && (
        <div className="modal-overlay" onClick={() => setShowCreateRuleModal(false)}>
          <div className="modal-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Create Alarm Rule</h3>
              <button onClick={() => setShowCreateRuleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-content">
              <form onSubmit={handleCreateRule}>
                <div className="rule-form-grid">
                  <div className="form-field full-width">
                    <label>Rule Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Checkout Service Error Spike"
                      value={newRule.name}
                      onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Target Service *</label>
                    <select
                      value={newRule.target_service}
                      onChange={(e) => setNewRule({ ...newRule, target_service: e.target.value })}
                    >
                      <option value="*">All Services (*)</option>
                      <option value="paymentservice">paymentservice</option>
                      <option value="frontend">frontend</option>
                      <option value="checkoutservice">checkoutservice</option>
                      <option value="cartservice">cartservice</option>
                      <option value="recommendationservice">recommendationservice</option>
                      <option value="productcatalogservice">productcatalogservice</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Metric *</label>
                    <select
                      value={newRule.metric}
                      onChange={(e) => setNewRule({ ...newRule, metric: e.target.value })}
                    >
                      <option value="latency_p95_ms">latency_p95_ms</option>
                      <option value="error_rate">error_rate</option>
                      <option value="requests_per_sec">requests_per_sec</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Operator *</label>
                    <select
                      value={newRule.operator}
                      onChange={(e) => setNewRule({ ...newRule, operator: e.target.value })}
                    >
                      <option value=">">&gt; (Greater than)</option>
                      <option value=">=">&gt;= (Greater or equal)</option>
                      <option value="<">&lt; (Less than)</option>
                      <option value="<=">&lt;= (Less or equal)</option>
                      <option value="==">== (Equals)</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Threshold Value *</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newRule.threshold}
                      onChange={(e) => setNewRule({ ...newRule, threshold: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Sustained Duration (Seconds) *</label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newRule.duration_seconds}
                      onChange={(e) => setNewRule({ ...newRule, duration_seconds: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Severity *</label>
                    <select
                      value={newRule.severity}
                      onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}
                    >
                      <option value="CRITICAL">Critical</option>
                      <option value="ERROR">Error</option>
                      <option value="WARNING">Warning</option>
                      <option value="INFO">Info</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Cooldown (Seconds)</label>
                    <input
                      type="number"
                      min="0"
                      value={newRule.cooldown_seconds}
                      onChange={(e) => setNewRule({ ...newRule, cooldown_seconds: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Recovery Threshold (Optional)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 50"
                      value={newRule.recovery_threshold}
                      onChange={(e) => setNewRule({ ...newRule, recovery_threshold: e.target.value })}
                    />
                  </div>

                  <div className="form-field full-width">
                    <label>Description</label>
                    <textarea
                      rows="2"
                      placeholder="Brief description of the alarm rule"
                      value={newRule.description}
                      onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateRuleModal(false)}>Cancel</button>
                  <button type="submit" className="btn-primary">Save Alarm Rule</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Incident Correlation Modal */}
      {selectedCorrelationId && (
        <AlarmCorrelationModal
          alarmId={selectedCorrelationId}
          onClose={() => setSelectedCorrelationId(null)}
        />
      )}
    </div>
  );
};

export default AlarmsPage;
