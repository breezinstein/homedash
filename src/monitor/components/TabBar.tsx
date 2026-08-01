interface TabBarProps {
  activeTab: 'infra' | 'media';
  onSwitch: (tab: 'infra' | 'media', manual: boolean) => void;
  remainingSeconds: number;
  rotationSeconds: number;
  mediaBadge?: string;
}

export function TabBar({ activeTab, onSwitch, remainingSeconds, rotationSeconds, mediaBadge }: TabBarProps) {
  const paused = remainingSeconds > rotationSeconds;
  const window = paused ? 60 : rotationSeconds;
  const ringPct = Math.max(0, Math.min(100, ((window - remainingSeconds) / window) * 100));

  return (
    <nav className="h-[46px] flex items-center gap-2 px-5 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
      <button
        className={`flex items-center gap-2 border rounded-lg px-[14px] py-[6px] text-[13px] font-semibold cursor-pointer transition-colors
          ${activeTab === 'infra' ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)]' : 'bg-transparent border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
        onClick={() => onSwitch('infra', true)}
      >
        ⬡ Infrastructure
      </button>

      <button
        className={`flex items-center gap-2 border rounded-lg px-[14px] py-[6px] text-[13px] font-semibold cursor-pointer transition-colors
          ${activeTab === 'media' ? 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)]' : 'bg-transparent border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
        onClick={() => onSwitch('media', true)}
      >
        🎬 Media &amp; Downloads
        {mediaBadge && (
          <span className="text-[10px] font-bold px-[7px] py-[1px] rounded-full bg-[color-mix(in_srgb,var(--color-primary)_16%,transparent)] text-[var(--color-primary)] tabular-nums">{mediaBadge}</span>
        )}
      </button>

      <div className="ml-auto flex items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
        {rotationSeconds > 0 && (
          <>
            <Ring pct={ringPct} />
            <span>{paused ? `rotation paused · resumes ${remainingSeconds}s` : `auto-rotate in ${remainingSeconds}s`}</span>
          </>
        )}
      </div>
    </nav>
  );
}

function Ring({ pct }: { pct: number }) {
  return (
    <span
      className="w-[15px] h-[15px] rounded-full border border-[var(--color-border)]"
      style={{
        background: `conic-gradient(var(--color-primary) ${pct}%, var(--color-surface) 0)`,
      }}
    />
  );
}
