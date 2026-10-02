import React, { useState, useEffect } from 'react';
import { History, Filter, RefreshCw, Search, AlertTriangle, AlertCircle, Info, CheckCircle2, Eye, X } from 'lucide-react';
import './HistoryPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const HistoryPage = () => {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filter options loaded from backend
  const [availableServices, setAvailableServices] = useState([]);
  const [availableTypes, setAvailableTypes] = useState([]);

  // Selected filters
  const [selectedRange, setSelectedRange] = useState('1h');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Metadata inspect modal
  const [inspectEvent, setInspectEvent] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load filter options
  useEffect(() => {
    fetch(`${API_BASE}/api/history/services`)
      .then(res => res.json())
      .then(data => {
        if (data.services) setAvailableServices(data.services);
        if (data.event_types) setAvailableTypes(data.event_types);
      })
      .catch(err => console.error("Error loading services/types:", err));
  }, []);

  // Fetch events based on filters
  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: pageSize.toString()
      });

      // Calculate time range
      if (selectedRange !== 'all') {
        const now = Date.now() / 1000;
        const rangeMap = {
          '15m': 15 * 60,
          '1h': 3600,
          '6h': 6 * 3600,
          '24h': 24 * 3600,
          '7d': 7 * 24 * 3600
        };
        const duration = rangeMap[selectedRange] || 3600;
        params.append('start_time', (now - duration).toString());
      }

      if (selectedService !== 'all') params.append('service', selectedService);
      if (selectedSeverity !== 'all') params.append('severity', selectedSeverity);
      if (selectedType !== 'all') params.append('event_type', selectedType);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await fetch(`${API_BASE}/api/history/events?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      console.error("Failed to load history events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [page, pageSize, selectedRange, selectedService, selectedSeverity, selectedType, selectedStatus]);

  // Auto-refresh interval (every 4 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchEvents();
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRefresh, page, pageSize, selectedRange, selectedService, selectedSeverity, selectedType, selectedStatus, searchTerm]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchEvents();
  };

  const resetFilters = () => {
    setSelectedRange('1h');
    setSelectedService('all');
    setSelectedSeverity('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setSearchTerm('');
    setPage(1);
  };

  const getSeverityIcon = (sev) => {
    switch (sev) {
      case 'CRITICAL': return <AlertCircle size={14} color="#DC2626" />;
      case 'ERROR': return <AlertCircle size={14} color="#DC2626" />;
      case 'WARNING': return <AlertTriangle size={14} color="#D97706" />;
      default: return <Info size={14} color="#2563EB" />;
    }
  };

  return (
    <div className="history-page-root animate-fade-in">
      {/* Header */}
      <header className="history-header">
        <div className="history-header-left">
          <div className="brand-logo">
            <History color="var(--accent-cyan)" size={28} />
          </div>
          <div>
            <h1>Event History & Audit Log</h1>
            <span className="brand-subtitle">Persistent chronological audit of autonomous events, alarms, and remediation</span>
          </div>
        </div>

        <div className="history-header-actions">
          <button 
            className={`btn-secondary ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Toggle periodic background refresh"
          >
            <RefreshCw size={15} className={autoRefresh ? 'spin-icon' : ''} />
            <span>Auto-Refresh: {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>
          <button className="btn-primary" onClick={fetchEvents}>
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Filter Panel */}
      <section className="panel-card">
        <div className="panel-header">
          <Filter size={18} />
          <h2>Filter & Search Audit Events</h2>
        </div>
        <div className="panel-content">
          <form className="filter-bar" onSubmit={handleSearchSubmit}>
            <div className="filter-group">
              <label>Time Range</label>
              <select 
                className="filter-select"
                value={selectedRange}
                onChange={(e) => { setSelectedRange(e.target.value); setPage(1); }}
              >
                <option value="15m">Last 15 Minutes</option>
                <option value="1h">Last 1 Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Service</label>
              <select 
                className="filter-select"
                value={selectedService}
                onChange={(e) => { setSelectedService(e.target.value); setPage(1); }}
              >
                <option value="all">All Services</option>
                {availableServices.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Severity</label>
              <select 
                className="filter-select"
                value={selectedSeverity}
                onChange={(e) => { setSelectedSeverity(e.target.value); setPage(1); }}
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="ERROR">Error</option>
                <option value="WARNING">Warning</option>
                <option value="INFO">Info</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Event Type</label>
              <select 
                className="filter-select"
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
              >
                <option value="all">All Event Types</option>
                {availableTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Status</label>
              <select 
                className="filter-select"
                value={selectedStatus}
                onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="firing">Firing</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div className="filter-group filter-input-search">
              <label>Search Message</label>
              <input 
                type="text"
                className="filter-input"
                placeholder="Search keywords, errors, actions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end', marginTop: 'auto' }}>
              <button type="submit" className="btn-primary">
                <Search size={15} /> Search
              </button>
              <button type="button" className="btn-secondary" onClick={resetFilters}>
                Reset
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Events Table Panel */}
      <section className="panel-card" style={{ flex: 1 }}>
        <div className="panel-header">
          <History size={18} />
          <h2>Audit Events ({total} records found)</h2>
        </div>
        <div className="panel-content">
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Severity</th>
                  <th>Source</th>
                  <th>Event Type</th>
                  <th>Service</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {loading ? "Loading audit events..." : "No historical events match the current filter criteria."}
                    </td>
                  </tr>
                ) : (
                  events.map((ev) => (
                    <tr key={ev.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {new Date(ev.timestamp_epoch * 1000).toLocaleString()}
                      </td>
                      <td>
                        <span className={`severity-badge severity-${ev.severity}`}>
                          {getSeverityIcon(ev.severity)}
                          {ev.severity}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{ev.source}</td>
                      <td>
                        <span className="event-type-badge">{ev.event_type}</span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: '#1F2937' }}>
                        {ev.service}
                      </td>
                      <td style={{ maxWidth: '400px' }}>
                        {ev.message}
                      </td>
                      <td>
                        <span className={`status-tag status-${ev.status || 'active'}`}>
                          {ev.status || 'active'}
                        </span>
                      </td>
                      <td>
                        {ev.metadata ? (
                          <button 
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                            onClick={() => setInspectEvent(ev)}
                            title="Inspect structured event metadata"
                          >
                            <Eye size={13} /> Details
                          </button>
                        ) : (
                          <span style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <span>
              Showing {events.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, total)} of {total} events
            </span>
            <div className="pagination-controls">
              <button 
                className="pagination-btn"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              >
                Previous
              </button>
              <span>Page {page} of {totalPages || 1}</span>
              <button 
                className="pagination-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              >
                Next
              </button>
              <select 
                className="filter-select"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                <option value="10">10 / page</option>
                <option value="25">25 / page</option>
                <option value="50">50 / page</option>
                <option value="100">100 / page</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Metadata Inspector Modal */}
      {inspectEvent && (
        <div className="modal-overlay" onClick={() => setInspectEvent(null)}>
          <div className="modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                Event Metadata (ID: #{inspectEvent.id})
              </h3>
              <button 
                onClick={() => setInspectEvent(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              <div style={{ marginBottom: '1rem' }}>
                <p><strong>Message:</strong> {inspectEvent.message}</p>
                <p><strong>Service:</strong> {inspectEvent.service} | <strong>Severity:</strong> {inspectEvent.severity}</p>
              </div>
              <h4>Structured Metadata:</h4>
              <pre className="meta-pre">
                {JSON.stringify(inspectEvent.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
