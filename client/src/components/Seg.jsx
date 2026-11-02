import React from 'react';

export default function Seg({ options, value, onChange, ariaLabel, disabled = false }) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const val = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        return (
          <button
            key={val}
            type="button"
            disabled={disabled}
            aria-pressed={value === val}
            onClick={() => onChange(val)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
