import React, { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import Kpi from '../components/Kpi.jsx';
import Badge from '../components/Badge.jsx';
import Seg from '../components/Seg.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { RateChart } from '../components/RateChart.jsx';
import api from '../api.js';
import { formatRate, formatCount, formatSeconds, formatBig } from '../format.js';

const PRESETS = [
  { id: 'az', label: 'a-z', value: 'abcdefghijklmnopqrstuvwxyz' },
  { id: 'AZ', label: 'A-Z', value: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' },
  { id: '09', label: '0-9', value: '0123456789' },
  { id: 'az09', label: 'a-z 0-9', value: 'abcdefghijklmnopqrstuvwxyz0123456789' },
  { id: 'hex', label: 'hex', value: '0123456789abcdef' },
];

const DEFAULTS = {
  algorithm: 'sha256',
  // SHA-256("hello") — the worked example from the project brief.
  targetHash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  length: 5,
  charset: 'abcdefghijklmnopqrstuvwxyz',
  mode: 'both',
  threads: 0,
  blockSize: 256,
  gridSize: 0,
};

export default function RunView({ onResult, health }) {
  const [form, setForm] = useState(DEFAULTS);
  const [plaintext, setPlaintext] = useState('hello');
  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [samples, setSamples] = useState([]);

  const keyspace = useMemo(() => Math.pow(form.charset.length || 1, form.length || 1), [form.charset, form.length]);
  const tooBig = keyspace > 2e9;

  useEffect(() => {
    if (!job || job.status !== 'running') return undefined;
    const timer = setInterval(async () => {
      try {
        const j = await api.getJob(job.id);
        setJob(j);
        if (j.progress && j.progress.rate > 0) {
          setSamples((prev) => [...prev.slice(-59), { t: j.progress.elapsed, rate: j.progress.rate }]);
        }
        if (j.status === 'done') {
          setResult(j.result);
          setBusy(false);
          if (onResult) onResult(j.result);
        } else if (j.status === 'error') {
          setError(j.error);
          setBusy(false);
        }
      } catch (err) {
        setError(err.message);
        setBusy(false);
      }
    }, 400);
    return () => clearInterval(timer);
  }, [job && job.id, job && job.status]);

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function generateHash() {
    setError(null);
    try {
      const r = await api.hash(plaintext, form.algorithm);
      set({ targetHash: r.hash });
    } catch (err) {
      setError(err.message);
    }
  }

  async function run() {
    setError(null);
    setResult(null);
    setSamples([]);
    setBusy(true);
    try {
      const started = await api.createJob(form);
      setJob({
        id: started.jobId,
        status: 'running',
        total: started.total,
        progress: { attempts: 0, percent: 0, rate: 0, elapsed: 0 },
        cuda: started.cuda,
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const running = busy && job && job.status === 'running';
  const progress = (job && job.progress) || { attempts: 0, percent: 0, rate: 0, elapsed: 0 };
  const cpu = (result && result.cpu) || (job && job.cpu) || null;
  const gpu = (result && result.gpu) || (job && job.gpu) || null;
  const speedup = result && result.speedup;
  const password = (result && result.password) || null;

  const statusPill = () => {
    if (error) return <Badge tone="err">error</Badge>;
    if (running) return <Badge tone="warn">running</Badge>;
    if (result && result.status === 'matched') return <Badge tone="ok">password matched</Badge>;
    if (result && result.status === 'not-found') return <Badge tone="err">not found</Badge>;
    if (result && result.status === 'timeout') return <Badge tone="warn">timed out</Badge>;
    return <Badge tone="info">idle</Badge>;
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1 className="view-title">Run</h1>
          <p className="view-desc">
            Pick a password, hash it, then watch the CPU and the GPU race to rediscover it. Every run is
            measured on this machine.
          </p>
        </div>
        <div className="btn-row">{statusPill()}</div>
      </div>

      <div className="grid g-2 mb-16">
        {/* ---------------- INPUT ---------------- */}
        <Card label="Input">
          <div className="field">
            <label className="fl" htmlFor="algo">Algorithm</label>
            <select id="algo" value={form.algorithm} onChange={(e) => set({ algorithm: e.target.value })}>
              <option value="sha256">SHA-256</option>
              <option value="sha1">SHA-1</option>
              <option value="md5">MD5</option>
            </select>
          </div>

          <div className="field">
            <label className="fl" htmlFor="target">Target hash</label>
            <textarea
              id="target"
              spellCheck="false"
              value={form.targetHash}
              onChange={(e) => set({ targetHash: e.target.value.trim() })}
            />
            <div className="row" style={{ marginTop: 8 }}>
              <input
                type="text"
                style={{ flex: '1 1 140px' }}
                value={plaintext}
                onChange={(e) => setPlaintext(e.target.value)}
                placeholder="plaintext to hash"
                aria-label="plaintext to hash"
              />
              <button className="btn btn--ghost btn--sm" onClick={generateHash}>Hash it</button>
            </div>
            <p className="hint">
              Generate the target from a password you choose — that is the only safe way to test this.
            </p>
          </div>

          <div className="field">
            <label className="fl">Character set</label>
            <div className="row mb-8">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`btn btn--sm ${form.charset === p.value ? 'btn--primary' : 'btn--ghost'}`}
                  onClick={() => set({ charset: p.value })}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              spellCheck="false"
              value={form.charset}
              onChange={(e) => set({ charset: e.target.value })}
              aria-label="custom character set"
            />
            <p className="hint">{form.charset.length} characters · custom sets allowed</p>
          </div>

          <div className="field">
            <label className="fl" htmlFor="len">Password length</label>
            <div className="row">
              <input
                id="len"
                type="number"
                min="1"
                max="12"
                style={{ width: 90 }}
                value={form.length}
                onChange={(e) => set({ length: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })}
              />
              <span className="hint" style={{ margin: 0 }}>
                keyspace {formatBig(keyspace)} candidates
              </span>
            </div>
          </div>

          <div className="field">
            <label className="fl">Execution mode</label>
            <Seg
              ariaLabel="Execution mode"
              value={form.mode}
              onChange={(v) => set({ mode: v })}
              options={[
                { value: 'both', label: 'CPU + GPU' },
                { value: 'cpu', label: 'CPU only' },
                { value: 'gpu', label: 'GPU only' },
              ]}
            />
          </div>

          <div className="field">
            <label className="fl">CUDA launch config</label>
            <div className="row">
              <span className="hint" style={{ margin: 0, minWidth: 44 }}>block</span>
              <input
                type="number"
                style={{ width: 88 }}
                value={form.blockSize}
                onChange={(e) => set({ blockSize: Number(e.target.value) || 256 })}
                aria-label="threads per block"
              />
              <span className="hint" style={{ margin: 0, minWidth: 34 }}>grid</span>
              <input
                type="number"
                style={{ width: 88 }}
                value={form.gridSize}
                onChange={(e) => set({ gridSize: Number(e.target.value) || 0 })}
                aria-label="grid size"
              />
              <span className="hint" style={{ margin: 0 }}>0 = auto</span>
            </div>
          </div>

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn--primary" onClick={run} disabled={running || tooBig || !form.targetHash}>
              {running ? 'Running…' : 'Run benchmark'}
            </button>
            {tooBig ? <span className="hint" style={{ color: 'var(--red)' }}>Keyspace too large — shorten the password.</span> : null}
          </div>
          {error ? <p className="err-text" style={{ marginTop: 10 }}>{error}</p> : null}
        </Card>

        {/* ---------------- OUTPUT ---------------- */}
        <Card label="Output">
          <div className="field">
            <div className="kpi-l" style={{ marginBottom: 6 }}>Password found</div>
            {password ? (
              <div className="pw">{password}</div>
            ) : (
              <div className="pw pw--empty">
                {running ? 'searching…' : result ? 'no match in keyspace' : '—'}
              </div>
            )}
          </div>

          <div className="grid g-kpi mb-16">
            <Kpi
              label="CPU time"
              value={cpu ? formatSeconds(cpu.seconds) : '—'}
              sub={cpu ? formatRate(cpu.rate) : 'sequential / worker threads'}
            />
            <Kpi
              label="GPU time"
              value={gpu ? formatSeconds(gpu.seconds) : '—'}
              sub={gpu ? formatRate(gpu.rate) : 'CUDA'}
            />
            <Kpi
              label="Speedup"
              value={speedup ? `${speedup.toFixed(2)}×` : '—'}
              color="var(--amber)"
              sub="GPU over CPU"
            />
          </div>

          <div className="field">
            <label className="fl">Search progress</label>
            <ProgressBar
              value={running ? progress.percent : result ? 100 : 0}
              left={`${formatCount(running ? progress.attempts : result ? result.attempts : 0)} / ${formatCount(job ? job.total : keyspace)} attempts`}
              right={running ? `${formatRate(progress.rate)} · ${formatSeconds(progress.elapsed)}` : result ? 'complete' : 'idle'}
            />
          </div>

          {gpu && gpu.simulated ? (
            <div className="note note--neutral" style={{ marginTop: 12 }}>
              <span>
                GPU timings are <b>modelled</b>, not measured — no CUDA binary was found. Build{' '}
                <span className="mono">cuda/</span> on a machine with an NVIDIA GPU to replace this with a real
                benchmark.
              </span>
            </div>
          ) : null}

          {gpu && !gpu.simulated ? (
            <div className="note" style={{ marginTop: 12 }}>
              <span>GPU timings measured by the native CUDA binary.</span>
            </div>
          ) : null}
        </Card>
      </div>

      <Card label="Throughput during the run" className="mb-16">
        {samples.length > 1 ? (
          <RateChart samples={samples} />
        ) : (
          <div className="empty">Run a job to plot hashes per second over time.</div>
        )}
      </Card>

      <Card label="Project input / output format" recessed>
        <div className="grid g-2">
          <div>
            <div className="kv-row"><span className="k">Target Hash</span><span className="v" style={{ fontSize: 10.5 }}>{(result ? result.input.targetHash : form.targetHash).slice(0, 24)}…</span></div>
            <div className="kv-row"><span className="k">Algorithm</span><span className="v">{form.algorithm.toUpperCase()}</span></div>
            <div className="kv-row"><span className="k">Password Length</span><span className="v">{form.length}</span></div>
            <div className="kv-row"><span className="k">Character Set</span><span className="v">{form.charset.length > 20 ? `${form.charset.slice(0, 20)}…` : form.charset}</span></div>
            <div className="kv-row"><span className="k">Execution Mode</span><span className="v">{form.mode}</span></div>
          </div>
          <div>
            <div className="kv-row"><span className="k">Total Attempts</span><span className="v">{formatCount(result ? result.attempts : 0)}</span></div>
            <div className="kv-row"><span className="k">CPU Speed</span><span className="v">{cpu ? formatRate(cpu.rate) : '—'}</span></div>
            <div className="kv-row"><span className="k">GPU Speed</span><span className="v">{gpu ? formatRate(gpu.rate) : '—'}</span></div>
            <div className="kv-row"><span className="k">GPU Speedup</span><span className="v">{speedup ? `${speedup.toFixed(2)}x` : '—'}</span></div>
            <div className="kv-row"><span className="k">Status</span><span className="v">{result ? result.status : 'idle'}</span></div>
          </div>
        </div>
      </Card>
    </div>
  );
}
