// components/ipd/vitals-trend-chart.tsx
'use client';

import React, { useEffect, useRef } from 'react';

interface VitalEntry {
  recorded_at: string;
  hr?: number; bp_sys?: number; bp_dia?: number;
  rr?: number; spo2?: number; temp?: number;
  gcs_total?: number; map?: number;
}

interface Props {
  entries: VitalEntry[];
  hoursBack?: number;
}

declare global { interface Window { Chart: any; } }

export default function VitalsTrendChart({ entries, hoursBack = 24 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || entries.length === 0) return;

    // Load Chart.js if not loaded
    const loadChart = () => {
      if (window.Chart) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    };

    loadChart().then(() => {
      if (chartRef.current) chartRef.current.destroy();

      const sorted = [...entries].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
      const labels = sorted.map(e => new Date(e.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

      chartRef.current = new window.Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'HR',
              data: sorted.map(e => e.hr || null),
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.1)',
              tension: 0.3, pointRadius: 3, borderWidth: 2,
              yAxisID: 'y',
            },
            {
              label: 'SBP',
              data: sorted.map(e => e.bp_sys || null),
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59,130,246,0.1)',
              tension: 0.3, pointRadius: 3, borderWidth: 2,
              yAxisID: 'y',
            },
            {
              label: 'DBP',
              data: sorted.map(e => e.bp_dia || null),
              borderColor: '#93c5fd',
              tension: 0.3, pointRadius: 2, borderWidth: 1.5,
              borderDash: [4, 2],
              yAxisID: 'y',
            },
            {
              label: 'SpO2',
              data: sorted.map(e => e.spo2 || null),
              borderColor: '#10b981',
              tension: 0.3, pointRadius: 3, borderWidth: 2,
              yAxisID: 'y1',
            },
            {
              label: 'RR',
              data: sorted.map(e => e.rr || null),
              borderColor: '#f59e0b',
              tension: 0.3, pointRadius: 2, borderWidth: 1.5,
              yAxisID: 'y',
            },
            {
              label: 'Temp',
              data: sorted.map(e => e.temp || null),
              borderColor: '#8b5cf6',
              tension: 0.3, pointRadius: 2, borderWidth: 1.5,
              yAxisID: 'y2',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              position: 'top',
              labels: { usePointStyle: true, pointStyle: 'line', padding: 12, font: { size: 11 } },
            },
            tooltip: {
              callbacks: {
                label: (ctx: any) => {
                  const label = ctx.dataset.label || '';
                  const val = ctx.parsed.y;
                  if (val === null) return '';
                  const units: Record<string, string> = { HR: 'bpm', SBP: 'mmHg', DBP: 'mmHg', SpO2: '%', RR: '/min', Temp: '°F' };
                  return `${label}: ${val} ${units[label] || ''}`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { font: { size: 10 }, maxRotation: 45 },
              grid: { color: 'rgba(0,0,0,0.04)' },
            },
            y: {
              position: 'left',
              title: { display: true, text: 'HR / BP / RR', font: { size: 10 } },
              min: 0, max: 220,
              ticks: { font: { size: 10 } },
              grid: { color: 'rgba(0,0,0,0.06)' },
            },
            y1: {
              position: 'right',
              title: { display: true, text: 'SpO2 %', font: { size: 10 } },
              min: 80, max: 100,
              ticks: { font: { size: 10 } },
              grid: { display: false },
            },
            y2: {
              position: 'right',
              title: { display: true, text: 'Temp °F', font: { size: 10 } },
              min: 95, max: 105,
              display: false,
            },
          },
        },
      });
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [entries]);

  if (entries.length === 0) {
    return <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No ICU chart data to plot. Add entries in ICU Chart tab first.</div>;
  }

  // Summary stats
  const latest = entries[0];
  const hrs = entries.map(e => e.hr).filter(Boolean) as number[];
  const sbps = entries.map(e => e.bp_sys).filter(Boolean) as number[];
  const spo2s = entries.map(e => e.spo2).filter(Boolean) as number[];

  return (
    <div>
      {/* Quick stats */}
      <div className="grid grid-cols-6 gap-2 mb-4">
        <div className="bg-red-50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500">HR (latest)</div>
          <div className="text-lg font-bold text-red-700">{latest?.hr || '—'}</div>
          {hrs.length > 1 && <div className="text-[10px] text-gray-400">{Math.min(...hrs)}–{Math.max(...hrs)}</div>}
        </div>
        <div className="bg-blue-50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500">BP (latest)</div>
          <div className="text-lg font-bold text-blue-700">{latest?.bp_sys && latest?.bp_dia ? `${latest.bp_sys}/${latest.bp_dia}` : '—'}</div>
          {sbps.length > 1 && <div className="text-[10px] text-gray-400">SBP {Math.min(...sbps)}–{Math.max(...sbps)}</div>}
        </div>
        <div className="bg-green-50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500">SpO2 (latest)</div>
          <div className="text-lg font-bold text-green-700">{latest?.spo2 || '—'}%</div>
          {spo2s.length > 1 && <div className="text-[10px] text-gray-400">{Math.min(...spo2s)}–{Math.max(...spo2s)}%</div>}
        </div>
        <div className="bg-yellow-50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500">RR</div>
          <div className="text-lg font-bold text-yellow-700">{latest?.rr || '—'}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500">Temp</div>
          <div className="text-lg font-bold text-purple-700">{latest?.temp || '—'}°F</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5 text-center">
          <div className="text-[10px] text-gray-500">GCS</div>
          <div className="text-lg font-bold">{latest?.gcs_total || '—'}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-gray-500">Vitals Trend — Last {hoursBack} hours ({entries.length} readings)</h3>
        </div>
        <div style={{ position: 'relative', height: '300px' }}>
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}
