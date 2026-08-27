import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

const ObservabilityChart = ({ data, systemState }) => {
  // ObservabilityChart directly takes data array from Dashboard now, no internal interval.
  const chartData = data;

  return (
    <div style={{ width: '100%', height: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Latency Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={systemState !== 'healthy' && systemState !== 'recovering' ? '#DC2626' : '#22C55E'} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={systemState !== 'healthy' && systemState !== 'recovering' ? '#DC2626' : '#22C55E'} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(val) => `${val}ms`} />
            <Tooltip 
              contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px' }}
              itemStyle={{ color: '#1F2937' }}
            />
            <Area 
              type="monotone" 
              dataKey="latency" 
              stroke={systemState !== 'healthy' && systemState !== 'recovering' ? '#DC2626' : '#22C55E'} 
              fillOpacity={1} 
              fill="url(#colorLatency)" 
              strokeWidth={2}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Errors / Traffic Chart could be added here later */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
            <XAxis dataKey="time" hide />
            <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(val) => `${val}%`} />
             <Tooltip 
              contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px' }}
              itemStyle={{ color: '#1F2937' }}
            />
            <Line type="monotone" dataKey="errors" stroke="#DC2626" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default ObservabilityChart;
