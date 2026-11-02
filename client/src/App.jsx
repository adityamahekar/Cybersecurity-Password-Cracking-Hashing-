import React, { useCallback, useEffect, useState } from 'react';
import RunView from './views/RunView.jsx';
import BenchmarkView from './views/BenchmarkView.jsx';
import ReportView from './views/ReportView.jsx';
import ScopeView from './views/ScopeView.jsx';
import api from './api.js';

const NAV = [
  { id: 'run', label: 'Run' },
  { id: 'bench', label: 'CPU vs GPU' },
  { id: 'report', label: 'Report' },
  { id: 'scope', label: 'Scope' },
];

export default function App() {
  const [view, setView] = useState('run');
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api
      .health()
      .then((h) => {
        setHealth(h);
        setHealthError(null);
      })
      .catch((err) => setHealthError(err.message));
  }, []);

  const onResult = useCallback((result) => {
    setLatest(result);
    api.history().then((r) => setHistory(r.history || [])).catch(() => {});
  }, []);

  const cudaMode = health && health.cuda ? health.cuda.mode : 'unknown';

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="#d9a441" strokeWidth="1.3" />
              <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="#d9a441" strokeWidth="1.3" opacity=".55" />
              <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="#d9a441" strokeWidth="1.3" opacity=".55" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="#46a170" strokeWidth="1.3" />
            </svg>
          </div>
          <div>
            <div className="brand-name">HashLab</div>
            <div className="brand-sub">CUDA benchmark</div>
          </div>
        </div>

        <nav className="nav" aria-label="Views">
          {NAV.map((item, i) => (
            <button
              key={item.id}
              className="nav-item"
              aria-current={view === item.id}
              onClick={() => setView(item.id)}
            >
              <span className="nav-num">{String(i + 1).padStart(2, '0')}</span>
              {item.label}
              {item.id === 'run' && latest ? <span className="nav-dot" /> : null}
            </button>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="scope-pill">SELF-GENERATED TARGETS ONLY</div>
          <p className="rail-note">Local benchmarking. No network access to any target.</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="tb-title">Session <span>#GH-0001</span></span>
          <span className="tb-sep" />
          <span className="chip"><b>{health ? health.algorithms.length : 3}</b> algorithms</span>
          <span className={`chip ${cudaMode === 'measured' ? 'chip--live' : 'chip--warn'}`}>
            CUDA · {cudaMode}
          </span>
          {healthError ? <span className="chip chip--err">API offline</span> : null}
          <div className="tb-right">
            <span className="chip"><b>{health ? health.cores : '—'}</b> cores</span>
          </div>
        </header>

        <div className="content">
          {healthError ? (
            <div className="note mb-16" style={{ background: 'var(--red-dim)', borderColor: 'rgba(201,96,79,0.28)', color: '#e0a89e' }}>
              <span>
                {healthError} Start it with <span className="mono">npm run dev:server</span> in a second terminal.
              </span>
            </div>
          ) : null}

          {view === 'run' ? <RunView onResult={onResult} health={health} /> : null}
          {view === 'bench' ? <BenchmarkView history={history} latest={latest} /> : null}
          {view === 'report' ? <ReportView latest={latest} health={health} /> : null}
          {view === 'scope' ? <ScopeView health={health} /> : null}

          <div className="statusbar">
            <span><b>api</b> {api.base}</span>
            <span><b>cores</b> {health ? health.cores : '—'}</span>
            <span><b>node</b> {health ? health.node : '—'}</span>
            <span><b>cuda</b> {cudaMode}</span>
            <span><b>keyspace cap</b> 2 × 10⁹</span>
            <span className="spacer">HashLab · self-generated test cases</span>
          </div>
        </div>
      </div>
    </div>
  );
}
