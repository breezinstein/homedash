import { Home, Server, Tv, Globe, Zap } from 'lucide-react';
import type { MonitorTab } from '../useTabRotation';

interface TabBarProps {
  activeTab: MonitorTab;
  onSwitch: (tab: MonitorTab) => void;
  remainingSeconds?: number;
  mediaBadge?: string;
}

const tabs: { key: MonitorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'server', label: 'Server', icon: Server },
  { key: 'media', label: 'Media', icon: Tv },
  { key: 'network', label: 'Network', icon: Globe },
  { key: 'power', label: 'Power', icon: Zap },
];

export function TabBar({ activeTab, onSwitch, remainingSeconds, mediaBadge }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = activeTab === t.key;
        return (
          <button
            key={t.key}
            className={`tab ${active ? 'active' : ''}`}
            onClick={() => onSwitch(t.key)}
          >
            <Icon className="w-3.5 h-3.5" />
            {t.label}
            {t.key === 'media' && mediaBadge && (
              <span className="tab-badge">{mediaBadge}</span>
            )}
          </button>
        );
      })}
      {remainingSeconds != null && remainingSeconds > 0 && (
        <span className="tab-rotation-hint">
          {remainingSeconds}s
        </span>
      )}
    </nav>
  );
}
