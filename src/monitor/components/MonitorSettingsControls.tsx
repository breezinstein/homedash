import type { ReactNode } from 'react';

export function SwitchToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={`ms-toggle-wrap ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      data-checked={checked}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div className="ms-toggle-track">
        <div className="ms-toggle-thumb" />
      </div>
    </div>
  );
}

export function FormField({
  label,
  helpText,
  children,
}: {
  label: string;
  helpText?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-[var(--mon-text-dim)] uppercase tracking-wider block">
        {label}
      </label>
      {children}
      {helpText && <p className="text-[11px] text-[var(--mon-text-faint)] leading-normal">{helpText}</p>}
    </div>
  );
}

export function TypePicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; color: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-bold text-[var(--mon-text-dim)] uppercase tracking-wider block">
        {label}
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`p-2.5 rounded-lg border text-xs font-semibold transition-all text-center ${
                isSelected
                  ? 'bg-[var(--mon-surface-2)] border-[var(--mon-accent)] text-[var(--mon-text)] shadow-sm'
                  : 'bg-[var(--mon-surface-2)] border-[var(--mon-border)] text-[var(--mon-text-muted)] hover:text-[var(--mon-text-dim)]'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
