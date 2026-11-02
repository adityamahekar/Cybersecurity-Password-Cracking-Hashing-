import React from 'react';

export default function ProgressBar({ value, left, right }) {
  return (
    <>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${Math.min(100, Math.max(0, value)).toFixed(2)}%` }} />
      </div>
      {(left || right) && (
        <div className="bar-meta">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </>
  );
}
