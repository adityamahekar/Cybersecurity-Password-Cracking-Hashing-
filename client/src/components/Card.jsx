import React from 'react';

export default function Card({ label, children, recessed = false, className = '' }) {
  return (
    <div className={`card ${recessed ? 'card--recessed' : ''} ${className}`}>
      {label ? <div className="section-label">{label}</div> : null}
      {children}
    </div>
  );
}
