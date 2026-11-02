import React from 'react';

const TONE = {
  ok: 'b-strong',
  strong: 'b-strong',
  warn: 'b-med',
  med: 'b-med',
  err: 'b-weak',
  weak: 'b-weak',
  info: 'b-info',
};

export default function Badge({ tone = 'info', children }) {
  return <span className={`badge ${TONE[tone] || 'b-info'}`}>{children}</span>;
}
