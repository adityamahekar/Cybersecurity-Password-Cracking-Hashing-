import React from 'react';
import Card from '../components/Card.jsx';
import Badge from '../components/Badge.jsx';
import { CompareChart } from '../components/RateChart.jsx';
import { formatSeconds, formatRate, formatCount } from '../format.js';

export default function BenchmarkView({ history, latest }) {
  const runs = history && history.length ? history : latest ? [latest] : [];
  const head = runs[0];

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">CPU vs GPU</h1>
          <p className="view-desc">
            Same keyspace, same target, two execution paths. The bar chart is time, so shorter is better.
          </p>
        </div>
      </div>

      {!head ? (
        <Card>
          <div className="empty">No runs yet. Execute a benchmark from the Run screen first.</div>
        </Card>
      ) : (
        <>
          <div className="grid g-2 mb-16">
            <Card label="Time to match">
              <CompareChart
                cpuSeconds={head.cpu ? head.cpu.seconds : 0}
                gpuSeconds={head.gpu ? head.gpu.seconds : 0}
              />
              <div className="row" style={{ marginTop: 12, gap: 18 }}>
                <span className="hint" style={{ margin: 0 }}>
                  CPU {head.cpu ? formatSeconds(head.cpu.seconds) : '—'} · GPU{' '}
                  {head.gpu ? formatSeconds(head.gpu.seconds) : '—'}
                </span>
                {head.speedup ? <Badge tone="strong">{head.speedup.toFixed(2)}× faster</Badge> : null}
                {head.gpu && head.gpu.simulated ? <Badge tone="med">GPU modelled</Badge> : null}
              </div>
            </Card>

            <Card label="Latest run" recessed>
              <div className="kv-row"><span className="k">Target</span><span className="v" style={{ fontSize: 10.5 }}>{head.input.targetHash.slice(0, 26)}…</span></div>
              <div className="kv-row"><span className="k">Algorithm</span><span className="v">{head.input.algorithmLabel || head.input.algorithm.toUpperCase()}</span></div>
              <div className="kv-row"><span className="k">Length</span><span className="v">{head.input.length}</span></div>
              <div className="kv-row"><span className="k">Charset</span><span className="v">{head.input.charset.length} chars</span></div>
              <div className="kv-row"><span className="k">Attempts</span><span className="v">{formatCount(head.attempts)}</span></div>
              <div className="kv-row"><span className="k">Result</span><span className="v">{head.password || head.status}</span></div>
            </Card>
          </div>

          <div className="tbl-wrap mb-16">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Algorithm</th>
                  <th className="r">Length</th>
                  <th className="r">Attempts</th>
                  <th className="r">CPU</th>
                  <th className="r">GPU</th>
                  <th className="r">Speedup</th>
                  <th>Found</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                      {new Date(r.createdAt).toTimeString().slice(0, 8)}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{r.input.algorithm.toUpperCase()}</td>
                    <td className="r">{r.input.length}</td>
                    <td className="r">{formatCount(r.attempts)}</td>
                    <td className="r">{r.cpu ? formatRate(r.cpu.rate) : '—'}</td>
                    <td className="r">{r.gpu ? formatRate(r.gpu.rate) : '—'}</td>
                    <td className="r" style={{ color: 'var(--amber)' }}>{r.speedup ? `${r.speedup.toFixed(2)}×` : '—'}</td>
                    <td>{r.password ? <Badge tone="ok">{r.password}</Badge> : <Badge tone="err">none</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="note note--neutral">
            <span>
              Attempts is the same on both sides — the GPU finds the password at the same index, just
              sooner. Any row marked “GPU modelled” used a projection instead of a measurement.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
