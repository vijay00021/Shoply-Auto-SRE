import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { LineChart as ChartIcon, RefreshCw, Activity, Layers, Radio } from 'lucide-react';
import ObservabilityChart from './ObservabilityChart';
import './GraphsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TIME_RANGES = ['15m', '1h', '6h', '24h', '7d', '30d'];

const GraphsPage = () => {
  const [selectedRange, setSelectedRange] = useState('1h');
  const [selectedService, setSelectedService] = useState('paymentservice');
  const [availableServices, setAvailableServices] = useState([
    'paymentservice', 'frontend', 'checkoutservice', 'cartservice'
  ]);

  const [latencyData, setLatencyData] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const [rpsData, setRpsData] = useState([]);
  const [liveMetrics, setLiveMetrics] = useState([]);
  const [loading, setLoading] = useState(false);

  // Poll real-time live telemetry stream for Observability (Grafana View)
  useEffect(() => {
    const fetchLiveMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/metrics`);
        if (res.ok) {
          const metricsData = await res.json();
          setLiveMetrics(prev => {
            const newData = [...prev];
            if (newData.length > 20) newData.shift();
            const lastTime = newData.length > 0 ? newData[newData.length - 1].time : 0;
            const target = metricsData[selectedService] || metricsData['paymentservice'] || { latency_p95_ms: 0, error_rate: 0 };
            newData.push({
              time: lastTime + 1,
              latency: target.latency_p95_ms || 0,
              errors: target.error_rate || 0
            });
            return newData;
          });
        }
      } catch (err) {
        console.error("Live metrics poll error:", err);
      }
    };

    fetchLiveMetrics();
    const timer = setInterval(fetchLiveMetrics, 2000);
    return () => clearInterval(timer);
  }, [selectedService]);

  // Load available services
  useEffect(() => {
    fetch(`${API_BASE}/api/history/services`)
      .then(res => res.json())
      .then(data => {
        if (data.services && data.services.length > 0) {
          setAvailableServices(data.services);
        }
      })
      .catch(err => console.error("Could not fetch services list:", err));
  }, []);

  // Fetch metrics for selected service & time range
  const fetchMetricHistory = async () => {
    setLoading(true);
    try {
      const [latencyRes, errorRes, rpsRes] = await Promise.all([
        fetch(`${API_BASE}/api/history/metrics?service=${selectedService}&metric_name=latency_p95_ms&range=${selectedRange}&target_points=120`),
        fetch(`${API_BASE}/api/history/metrics?service=${selectedService}&metric_name=error_rate&range=${selectedRange}&target_points=120`),
        fetch(`${API_BASE}/api/history/metrics?service=${selectedService}&metric_name=requests_per_sec&range=${selectedRange}&target_points=120`)
      ]);

      if (latencyRes.ok) {
        const d = await latencyRes.json();
        setLatencyData(d.points || []);
      }
      if (errorRes.ok) {
        const d = await errorRes.json();
        setErrorData(d.points || []);
      }
      if (rpsRes.ok) {
        const d = await rpsRes.json();
        setRpsData(d.points || []);
      }
    } catch (err) {
      console.error("Failed to load historical metric series:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetricHistory();
  }, [selectedService, selectedRange]);

  // Compute stat highlights
  const avgLatency = latencyData.length > 0 
    ? Math.round(latencyData.reduce((acc, p) => acc + p.value, 0) / latencyData.length) 
    : 0;
  const maxLatency = latencyData.length > 0 
    ? Math.max(...latencyData.map(p => p.max || p.value)) 
    : 0;
  const maxError = errorData.length > 0 
    ? Math.max(...errorData.map(p => p.max || p.value)) 
    : 0;
  const avgRps = rpsData.length > 0 
    ? Math.round(rpsData.reduce((acc, p) => acc + p.value, 0) / rpsData.length) 
    : 0;

  // Custom Tooltip Formatter
  const renderTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      const dateStr = point.timestamp 
        ? new Date(point.timestamp).toLocaleTimeString() 
        : (point.timestamp_epoch ? new Date(point.timestamp_epoch * 1000).toLocaleTimeString() : '');

      return (
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '0.6rem 0.8rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6B7280' }}>Time: {dateStr}</p>
          <p style={{ margin: '0.2rem 0 0 0', fontWeight: 700, color: payload[0].color, fontSize: '0.9rem' }}>
            Avg: {point.value} {point.unit || ''}
          </p>
          {point.max !== undefined && point.max !== point.value && (
            <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.75rem', color: '#DC2626' }}>
              Peak Spike: {point.max}
            </p>
          )}
          {point.count > 1 && (
            <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.7rem', color: '#9CA3AF' }}>
              Aggregated from {point.count} samples
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="graphs-page-root animate-fade-in">
      {/* Header */}
      <header className="graphs-header">
        <div className="graphs-header-left">
          <div className="brand-logo">
            <ChartIcon color="var(--accent-cyan)" size={28} />
          </div>
          <div>
            <h1>Historical Metrics & Analytics</h1>
            <span className="brand-subtitle">Telemetry trend analysis with spike preservation and downsampled aggregation</span>
          </div>
        </div>

        <div className="graphs-controls">
          {/* Service Selector */}
          <select 
            className="filter-select"
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
          >
            {availableServices.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Time Range Selector */}
          <div className="range-btn-group">
            {TIME_RANGES.map(range => (
              <button 
                key={range}
                className={`range-btn ${selectedRange === range ? 'active' : ''}`}
                onClick={() => setSelectedRange(range)}
              >
                {range}
              </button>
            ))}
          </div>

          <button className="btn-secondary" onClick={fetchMetricHistory} title="Refresh dataset">
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* KPI Stats Bar */}
      <div className="metric-summary-grid">
        <div className="metric-stat-card">
          <span className="metric-stat-title">Average p95 Latency</span>
          <span className="metric-stat-value" style={{ color: avgLatency > 500 ? '#DC2626' : '#1F2937' }}>
            {avgLatency} ms
          </span>
          <span className="metric-stat-sub">Across selected {selectedRange} window</span>
        </div>

        <div className="metric-stat-card">
          <span className="metric-stat-title">Peak Spike Latency</span>
          <span className="metric-stat-value" style={{ color: maxLatency > 1000 ? '#DC2626' : '#D97706' }}>
            {maxLatency} ms
          </span>
          <span className="metric-stat-sub">Highest recorded latency point</span>
        </div>

        <div className="metric-stat-card">
          <span className="metric-stat-title">Max Error Rate</span>
          <span className="metric-stat-value" style={{ color: maxError > 5 ? '#DC2626' : '#16A34A' }}>
            {maxError}%
          </span>
          <span className="metric-stat-sub">Peak error rate breach</span>
        </div>

        <div className="metric-stat-card">
          <span className="metric-stat-title">Average Throughput</span>
          <span className="metric-stat-value">
            {avgRps} req/s
          </span>
          <span className="metric-stat-sub">Mean requests per second</span>
        </div>
      </div>

      {/* Observability (Grafana View) - Live Telemetry Stream */}
      <section className="chart-card" style={{ marginBottom: '1.5rem' }}>
        <div className="chart-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Activity color="#22C55E" size={18} />
            <h3 style={{ margin: 0 }}>Observability (Grafana View) — Live Telemetry Stream</h3>
            <span style={{ 
              background: '#ECFDF5', 
              color: '#059669', 
              fontSize: '0.72rem', 
              fontWeight: 700, 
              padding: '0.15rem 0.5rem', 
              borderRadius: '10px', 
              border: '1px solid #A7F3D0',
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem' 
            }}>
              <span className="pulse-indicator" style={{ width: '6px', height: '6px', background: '#059669' }}></span>
              LIVE 2s
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>
            Streaming latency (p95) and error rate for {selectedService}
          </span>
        </div>
        <div className="chart-card-content" style={{ padding: '1rem', height: '320px' }}>
          <ObservabilityChart data={liveMetrics} systemState="healthy" />
        </div>
      </section>

      {/* Main Charts Grid */}
      <div className="charts-grid">
        {/* Latency History Chart */}
        <section className="chart-card">
          <div className="chart-card-header">
            <h3>Latency (p95 ms) — {selectedService}</h3>
            <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>
              Range: {selectedRange} | {latencyData.length} aggregated points
            </span>
          </div>
          <div className="chart-card-content">
            {latencyData.length === 0 ? (
              <div className="empty-chart-notice">
                {loading ? "Loading telemetry..." : "No historical metric data available yet. Data samples every 2 seconds."}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={latencyData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(val) => `${val}ms`} />
                  <Tooltip content={renderTooltip} />
                  <ReferenceLine y={1000} stroke="#DC2626" strokeDasharray="3 3" label={{ value: "Crit 1000ms", fill: "#DC2626", fontSize: 10 }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#22C55E" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#latencyGradient)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 2-Column Section for Error Rate & RPS */}
        <div className="charts-grid charts-grid-2col">
          {/* Error Rate Chart */}
          <section className="chart-card">
            <div className="chart-card-header">
              <h3>Error Rate (%) — {selectedService}</h3>
              <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Threshold: 10%</span>
            </div>
            <div className="chart-card-content">
              {errorData.length === 0 ? (
                <div className="empty-chart-notice">
                  {loading ? "Loading telemetry..." : "No historical error data available."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={errorData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#DC2626" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#DC2626" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(val) => `${val}%`} />
                    <Tooltip content={renderTooltip} />
                    <ReferenceLine y={15} stroke="#DC2626" strokeDasharray="3 3" />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#DC2626" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#errorGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>

          {/* Requests Per Second Chart */}
          <section className="chart-card">
            <div className="chart-card-header">
              <h3>Traffic Volume (RPS) — {selectedService}</h3>
              <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Requests per second</span>
            </div>
            <div className="chart-card-content">
              {rpsData.length === 0 ? (
                <div className="empty-chart-notice">
                  {loading ? "Loading telemetry..." : "No historical traffic data available."}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rpsData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rpsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(val) => `${val}`} />
                    <Tooltip content={renderTooltip} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#2563EB" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#rpsGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GraphsPage;
