import React from 'react';
import Card from '../components/Card.jsx';
import Kpi from '../components/Kpi.jsx';
import { formatSeconds, formatRate, formatCount } from '../format.js';

function download(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportView({ latest, health }) {
  if (!latest) {
    return (
      <div className="view">
        <div className="view-head">
          <div>
            <h1 className="view-title">Report</h1>
            <p className="view-desc">A generated summary of the last benchmark, ready to paste into a write-up.</p>
          </div>
        </div>
        <Card>
          <div className="empty">Nothing to report yet — run a benchmark first.</div>
        </Card>
      </div>
    );
  }

  const lines = [
    'GPU-Accelerated Password Hashing and Cracking — benchmark report',
    '',
    `Algorithm:        ${latest.input.algorithmLabel || latest.input.algorithm.toUpperCase()}`,
    `Target hash:      ${latest.input.targetHash}`,
    `Password length:  ${latest.input.length}`,
    `Character set:    ${latest.input.charset} (${latest.input.charset.length} chars)`,
    `Keyspace:         ${formatCount(latest.total)} candidates`,
    `Attempts made:    ${formatCount(latest.attempts)}`,
    `Password found:   ${latest.password || '(none)'}`,
    '',
    `CPU time:         ${latest.cpu ? formatSeconds(latest.cpu.seconds) : 'n/a'} at ${latest.cpu ? formatRate(latest.cpu.rate) : 'n/a'}`,
    `GPU time:         ${latest.gpu ? formatSeconds(latest.gpu.seconds) : 'n/a'} at ${latest.gpu ? formatRate(latest.gpu.rate) : 'n/a'}`,
    `Speedup:          ${latest.speedup ? latest.speedup.toFixed(2) + 'x' : 'n/a'}`,
    `GPU data source:  ${latest.gpu && latest.gpu.simulated ? 'modelled (no CUDA binary)' : 'measured on device'}`,
    '',
    `Machine:          ${health ? health.cores + ' CPU cores, Node ' + health.node : 'unknown'}`,
    `Generated:        ${new Date(latest.createdAt).toLocaleString('en-IN')}`,
  ];
  const text = lines.join('\n');

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">Report</h1>
          <p className="view-desc">A generated summary of the last benchmark, ready to paste into a write-up.</p>
        </div>
        <div className="btn-row">
          <button className="btn btn--ghost btn--sm" onClick={() => download('benchmark-report.txt', text)}>Export TXT</button>
          <button className="btn btn--ghost btn--sm" onClick={() => download('benchmark-report.json', JSON.stringify(latest, null, 2), 'application/json')}>Export JSON</button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => navigator.clipboard && navigator.clipboard.writeText(text)}
          >
            Copy
          </button>
        </div>
      </div>

      <div className="grid g-kpi mb-16">
        <Kpi label="CPU time" value={latest.cpu ? formatSeconds(latest.cpu.seconds) : '—'} sub={latest.cpu ? formatRate(latest.cpu.rate) : ''} />
        <Kpi label="GPU time" value={latest.gpu ? formatSeconds(latest.gpu.seconds) : '—'} sub={latest.gpu ? formatRate(latest.gpu.rate) : ''} />
        <Kpi label="Speedup" value={latest.speedup ? `${latest.speedup.toFixed(2)}×` : '—'} color="var(--amber)" sub="GPU over CPU" />
        <Kpi label="Attempts" value={formatCount(latest.attempts)} sub={`of ${formatCount(latest.total)} keyspace`} />
      </div>

      <Card label="Generated summary" recessed>
        <pre className="mono" style={{ fontSize: 11.5, lineHeight: 1.85, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>
{text}
        </pre>
      </Card>
    </div>
  );
}
