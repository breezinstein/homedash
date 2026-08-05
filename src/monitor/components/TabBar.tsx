import type { MonitorTab } from '../useTabRotation';

interface TabBarProps {
  activeTab: MonitorTab;
  onSwitch: (tab: MonitorTab) => void;
  remainingSeconds?: number;
  mediaBadge?: string;
}

const tabs: { key: MonitorTab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'server', label: 'Server' },
  { key: 'media', label: 'Media' },
  { key: 'network', label: 'Network' },
  { key: 'power', label: 'Power' },
];

export function TabBar({ activeTab, onSwitch, remainingSeconds, mediaBadge }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`tab ${activeTab === t.key ? 'active' : ''}`}
          onClick={() => onSwitch(t.key)}
        >
          {t.label}
          {t.key === 'media' && mediaBadge && (
            <span className="tab-badge">{mediaBadge}</span>
          )}
        </button>
      ))}
      {remainingSeconds != null && remainingSeconds > 0 && (
        <span className="tab-rotation-hint">
          {remainingSeconds}s
        </span>
      )}
    </nav>
  );
}
