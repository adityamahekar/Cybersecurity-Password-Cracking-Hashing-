import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

const GRID = 'rgba(255,255,255,0.06)';
const TICK = '#5f6b6f';

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 250 },
  plugins: {
    legend: {
      display: true,
      labels: { color: '#8b979b', boxWidth: 10, boxHeight: 10, font: { family: 'IBM Plex Mono', size: 10 } },
    },
    tooltip: {
      backgroundColor: '#192024',
      borderColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      titleFont: { family: 'IBM Plex Mono', size: 11 },
      bodyFont: { family: 'IBM Plex Mono', size: 11 },
    },
  },
  scales: {
    x: { grid: { color: GRID }, ticks: { color: TICK, font: { family: 'IBM Plex Mono', size: 10 } } },
    y: {
      grid: { color: GRID },
      ticks: {
        color: TICK,
        font: { family: 'IBM Plex Mono', size: 10 },
        callback: (v) => formatAxis(v),
      },
    },
  },
};

function formatAxis(v) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}G`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}k`;
  return String(v);
}

export function RateChart({ samples }) {
  const labels = samples.map((s) => `${s.t.toFixed(1)}s`);
  const data = {
    labels,
    datasets: [
      {
        label: 'hashes / sec',
        data: samples.map((s) => Math.round(s.rate)),
        borderColor: '#d9a441',
        backgroundColor: 'rgba(217,164,65,0.18)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 1.8,
      },
    ],
  };
  return (
    <div className="chart-box">
      <Line data={data} options={baseOptions} />
    </div>
  );
}

export function CompareChart({ cpuSeconds, gpuSeconds }) {
  const data = {
    labels: ['CPU', 'GPU (CUDA)'],
    datasets: [
      {
        label: 'seconds',
        data: [cpuSeconds, gpuSeconds],
        backgroundColor: ['#6d93b0', '#d9a441'],
        borderRadius: 4,
        barThickness: 46,
      },
    ],
  };
  const options = {
    ...baseOptions,
    indexAxis: 'y',
    plugins: { ...baseOptions.plugins, legend: { display: false } },
    scales: {
      x: {
        grid: { color: GRID },
        ticks: { color: TICK, font: { family: 'IBM Plex Mono', size: 10 }, callback: (v) => `${v}s` },
      },
      y: { grid: { display: false }, ticks: { color: '#8b979b', font: { family: 'IBM Plex Mono', size: 11 } } },
    },
  };
  return (
    <div className="chart-box" style={{ height: 150 }}>
      <Bar data={data} options={options} />
    </div>
  );
}

export default RateChart;
