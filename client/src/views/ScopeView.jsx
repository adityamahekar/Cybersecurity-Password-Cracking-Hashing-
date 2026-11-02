import React from 'react';
import Card from '../components/Card.jsx';

const STACK = [
  ['Frontend', 'React.js + Vite'],
  ['Backend', 'Node.js + Express'],
  ['GPU processing', 'CUDA C++'],
  ['CPU processing', 'Node worker threads'],
  ['Hashing', 'SHA-256 (plus SHA-1, MD5 for comparison)'],
  ['Visualisation', 'Chart.js'],
  ['Communication', 'REST API'],
];

export default function ScopeView({ health }) {
  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">Scope &amp; stack</h1>
          <p className="view-desc">What this tool does, what it refuses to do, and what it is built from.</p>
        </div>
      </div>

      <div className="grid g-2">
        <Card label="Authorised use">
          <div className="note mb-16">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L12.5 3v4c0 3-2.3 5.2-5.5 6C3.8 12.2 1.5 10 1.5 7V3L7 1z" stroke="#d9a441" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span>Run this only against hashes you generated yourself.</span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.75, marginBottom: 12 }}>
            The tool exists to demonstrate one thing: how parallel execution changes the cost of brute-force
            hash matching. It works on self-generated targets — you choose a password, hash it, then watch
            the machine find it again.
          </p>
          <p style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.75 }}>
            The keyspace is capped at 2 × 10⁹ candidates and runs time out at 120 seconds, so it stays a
            benchmark rather than a cracking rig. There is no dictionary, no rule engine, no mask attack and
            no network access of any kind.
          </p>
        </Card>

        <Card label="Technologies">
          {STACK.map(([k, v]) => (
            <div className="kv-row" key={k}>
              <span className="k">{k}</span>
              <span className="v">{v}</span>
            </div>
          ))}
          <div className="section-label" style={{ marginTop: 18 }}>This machine</div>
          <div className="kv-row">
            <span className="k">CPU cores</span>
            <span className="v">{health ? health.cores : '—'}</span>
          </div>
          <div className="kv-row">
            <span className="k">Node</span>
            <span className="v">{health ? health.node : '—'}</span>
          </div>
          <div className="kv-row">
            <span className="k">CUDA</span>
            <span className="v">{health && health.cuda ? health.cuda.mode : '—'}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
