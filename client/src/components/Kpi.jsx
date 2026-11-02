import React from 'react';

export default function Kpi({ label, value, unit, sub, hero = false, color }) {
  return (
    <div className={`kpi ${hero ? 'kpi--hero' : ''}`}>
      <div className="kpi-l">{label}</div>
      <div className="kpi-v" style={color ? { color } : undefined}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  );
}
