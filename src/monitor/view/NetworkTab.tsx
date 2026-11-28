import { useState } from 'react';
import { Activity, Cable, Lock, Shield } from 'lucide-react';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import type { CertificateSnapshot, NtopngSnapshot, OpnsenseInterfaceStats, OpnsenseSnapshot } from '../../types';
import { InlineAlert, LevelMeter } from '../../components/ui';
import { expiryLevel } from '../../lib/levels';
import { formatBitRate, formatBytes, formatWindow } from '../format';
import { Chip, Dot, Empty, LevelChip, MonPanel, Row, SectionLabel } from './parts';

interface NetworkTabProps {
  opnsense: OpnsenseSnapshot | null;
  ntopng: NtopngSnapshot | null;
  certificates: CertificateSnapshot | null;
}

/** Firewall, WAN links, LAN interfaces, top talkers and certificates. */
export function NetworkTab({ opnsense, ntopng, certificates }: NetworkTabProps) {
  if (!opnsense && !ntopng && !(certificates?.items?.length)) {
    return <Empty>Add OPNsense, ntopng or a certificate to watch in Settings → Network appliances.</Empty>;
  }
  return (
    <div className="mv-stack">
      {opnsense && <FirewallPanel opn={opnsense} />}
      {opnsense && opnsense.wanInterfaces.length > 0 && (
        <>
          <SectionLabel count={opnsense.wanInterfaces.length}>WAN links</SectionLabel>
          <div className="mv-cards">
            {opnsense.wanInterfaces.map((w) => <WanCard key={w.name} wan={w} />)}
          </div>
        </>
      )}
      <div className="mv-grid-2">
        <TalkersPanel ntopng={ntopng} opnsense={opnsense} />
        {opnsense && opnsense.lanInterfaces.length > 0 ? (
          <MonPanel
            title="LAN interfaces"
            icon={Cable}
            actions={<Chip>{opnsense.lanInterfaces.filter((i) => /^up$/i.test(i.status)).length} up</Chip>}
          >
            {opnsense.lanInterfaces.map((i) => (
              <Row
                key={i.name}
                lead={<Dot tone={/^up$/i.test(i.status) ? 'success' : 'danger'} />}
                title={i.description || i.name}
                sub={<span className="mv-mono">{i.name}{i.speedBps ? ` · ${formatBitRate(i.speedBps / 8)}` : ''}</span>}
                trail={<span className="mv-num">↓{formatBitRate(i.inBps)} ↑{formatBitRate(i.outBps)}</span>}
              />
            ))}
          </MonPanel>
        ) : null}
      </div>
      {certificates && certificates.items.length > 0 && <CertificatesPanel certs={certificates} />}
    </div>
  );
}

function FirewallPanel({ opn }: { opn: OpnsenseSnapshot }) {
  return (
    <MonPanel
      title={opn.hostname || 'OPNsense'}
      icon={Shield}
      meta={[opn.version, opn.uptime ? `up ${opn.uptime}` : null].filter(Boolean).join(' · ')}
      actions={opn.status === 'down' ? <Chip tone="danger">Offline</Chip> : opn.status === 'degraded' ? <Chip tone="warning">Degraded</Chip> : <Chip tone="success">Online</Chip>}
    >
      {opn.error && <InlineAlert tone="warning" className="mv-inset">{opn.error}</InlineAlert>}
      <div className="mv-sys">
        <LevelMeter label="CPU" value={opn.cpuPercent} />
        <LevelMeter label="Memory" value={opn.memPercent} />
        <LevelMeter label="Disk" value={opn.diskPercent} />
        <Figure label="Firewall states" value={opn.firewallStates != null ? opn.firewallStates.toLocaleString() : '—'} />
        <Figure label="DHCP leases" value={opn.dhcpLeases != null ? String(opn.dhcpLeases) : '—'} />
        <Figure label="Link capacity" value={opn.totalLinkCapacityBps ? formatBitRate(opn.totalLinkCapacityBps / 8) : '—'} />
      </div>
    </MonPanel>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="mv-figure">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function WanCard({ wan }: { wan: OpnsenseInterfaceStats }) {
  const up = /^up$/i.test(wan.status);
  const cap = wan.speedBps && wan.speedBps > 0 ? wan.speedBps : null;
  const pct = (bytes: number | null) => (cap && bytes != null ? Math.min(100, ((bytes * 8) / cap) * 100) : null);
  return (
    <article className="mv-card" data-tone={up ? undefined : 'danger'} aria-label={wan.description || wan.name}>
      <header className="mv-card-head">
        <Dot tone={up ? 'success' : 'danger'} />
        <h4 className="mv-card-title">{wan.description || wan.name}</h4>
        <span className="mv-mono mv-faint">{wan.name}</span>
        <span className="ml-auto flex flex-wrap justify-end gap-1">
          {wan.active ? <Chip tone="info">Active gateway</Chip> : <Chip>Standby</Chip>}
          <Chip tone={up ? 'success' : 'danger'}>{up ? `Up${cap ? ` · ${formatBitRate(cap / 8)}` : ''}` : wan.status}</Chip>
        </span>
      </header>
      <LevelMeter
        label="Download"
        detail={up ? formatBitRate(wan.inBps) : undefined}
        value={up ? pct(wan.inBps) : null}
        valueText={!up ? '—' : cap ? undefined : formatBitRate(wan.inBps)}
      />
      <LevelMeter
        label="Upload"
        detail={up ? formatBitRate(wan.outBps) : undefined}
        value={up ? pct(wan.outBps) : null}
        valueText={!up ? '—' : cap ? undefined : formatBitRate(wan.outBps)}
      />
    </article>
  );
}

function TalkersPanel({ ntopng, opnsense }: { ntopng: NtopngSnapshot | null; opnsense: OpnsenseSnapshot | null }) {
  const hasLive = !!ntopng && ntopng.status !== 'down' && ntopng.topTalkers.length > 0;
  const hasFlow = !!opnsense && opnsense.netflowTalkers.length > 0;
  const [source, setSource] = useState<'live' | 'flow'>(hasLive ? 'live' : 'flow');
  const showing = source === 'live' && hasLive ? 'live' : hasFlow ? 'flow' : hasLive ? 'live' : null;

  return (
    <MonPanel
      title="Top talkers"
      icon={Activity}
      actions={
        hasLive && hasFlow ? (
          <SegmentedControl
            aria-label="Talker source"
            className="ui-seg"
            value={showing}
            onValueChange={(next) => { if (next) setSource(next as 'live' | 'flow'); }}
          >
            <SegmentedControlIndicator />
            <SegmentedControlItem value="live" className="ui-seg-item">ntopng live</SegmentedControlItem>
            <SegmentedControlItem value="flow" className="ui-seg-item">NetFlow total</SegmentedControlItem>
          </SegmentedControl>
        ) : showing === 'live' ? <Chip>ntopng{ntopng?.source === 'community' ? ' Community' : ''}</Chip>
          : showing === 'flow' ? <Chip>NetFlow</Chip> : null
      }
    >
      {showing === 'live' && ntopng && (
        <>
          {ntopng.topTalkers.slice(0, 6).map((t) => {
            const rx = t.rxBps ?? 0;
            const tx = t.txBps ?? 0;
            const total = rx + tx;
            const window = formatWindow(t.firstSeen);
            return (
              <Row
                key={t.address}
                title={t.name || t.address}
                sub={<span className="mv-mono">{t.name ? `${t.address} · ` : ''}{formatBytes(t.bytes)}{window ? ` in ${window}` : ''}</span>}
                trail={
                  <span className="mv-talk">
                    <span className="mv-split" aria-hidden="true">
                      <i data-dir="rx" style={{ flexGrow: total ? rx : 1 }} />
                      <i data-dir="tx" style={{ flexGrow: total ? tx : 1 }} />
                    </span>
                    <span className="mv-num">↓{formatBitRate(t.rxBps)} ↑{formatBitRate(t.txBps)}</span>
                  </span>
                }
              />
            );
          })}
          <p className="mv-legend"><span><i data-dir="rx" />Download</span><span><i data-dir="tx" />Upload</span></p>
        </>
      )}
      {showing === 'flow' && opnsense && (
        opnsense.netflowTalkers.slice(0, 6).map((t) => (
          <Row
            key={t.address}
            title={t.hostname || t.address}
            sub={<span className="mv-mono">{t.hostname ? `${t.address} · ` : ''}{formatBytes(t.bytes)}</span>}
            trail={
              <span className="mv-talk">
                <span className="mv-share" aria-hidden="true"><i style={{ width: `${Math.min(100, t.percentage)}%` }} /></span>
                <span className="mv-num">{t.percentage.toFixed(1)}%</span>
              </span>
            }
          />
        ))
      )}
      {!showing && <Empty>{talkersHint(ntopng, opnsense)}</Empty>}
    </MonPanel>
  );
}

function talkersHint(ntopng: NtopngSnapshot | null, opnsense: OpnsenseSnapshot | null): string {
  if (ntopng && (ntopng.status === 'down' || ntopng.error)) return `ntopng isn't answering${ntopng.error ? `: ${ntopng.error}` : '.'}`;
  if (ntopng) return `ntopng is connected${ntopng.ifname ? ` on ${ntopng.ifname}` : ''} but saw no active hosts in this window.`;
  if (opnsense?.netflowStatus === 'error') return `The OPNsense NetFlow query failed${opnsense.netflowError ? `: ${opnsense.netflowError}` : '.'}`;
  if (opnsense?.netflowStatus === 'unavailable') return 'Turn on the os-insight (NetFlow) plugin on OPNsense, or add ntopng in Settings, to see top talkers.';
  if (opnsense) return 'OPNsense returned no top talkers in this window.';
  return 'Add ntopng in Settings to see top talkers.';
}

const CERTS_SHOWN = 8;

function CertificatesPanel({ certs }: { certs: CertificateSnapshot }) {
  const sorted = [...certs.items].sort((a, b) => {
    const rank = (c: typeof a) => (c.status === 'error' ? -1 : c.daysLeft ?? Infinity);
    return rank(a) - rank(b);
  });
  const items = sorted.slice(0, CERTS_SHOWN);
  const rest = sorted.slice(CERTS_SHOWN);
  const restMin = rest.reduce<number | null>((m, c) => (c.daysLeft != null && (m == null || c.daysLeft < m) ? c.daysLeft : m), null);
  const next = certs.minDaysLeft;
  const nextLevel = expiryLevel(next);
  return (
    <MonPanel
      title="Certificates"
      icon={Lock}
      actions={next != null ? (
        <LevelChip level={nextLevel}>{next < 0 ? 'One has expired' : `Next expiry in ${next} ${next === 1 ? 'day' : 'days'}`}</LevelChip>
      ) : null}
    >
      <div className="mv-certs">
        {items.map((c) => {
          const lvl = c.status === 'error' ? undefined : expiryLevel(c.daysLeft);
          const days = c.daysLeft;
          const expires = c.expiresAt ? new Date(c.expiresAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
          return (
            <div key={c.id} className="mv-cert">
              <LevelMeter
                label={c.name}
                detail={`${c.host}:${c.port}${c.status === 'error' ? ` · ${c.error || 'check failed'}` : expires ? ` · expires ${expires}` : ''}`}
                value={c.status === 'error' || days == null ? null : Math.max(0, Math.min(90, days))}
                max={90}
                level={lvl}
                valueText={c.status === 'error' ? 'Check failed' : days == null ? 'Not checked' : days < 0 ? 'Expired' : `${days} days`}
                valueLabel={c.status === 'error' ? 'Check failed' : days == null ? 'Not checked yet' : `${days} days left`}
              />
            </div>
          );
        })}
      </div>
      <p className="mv-legend">
        {rest.length > 0 ? `+${rest.length} more, none expiring within ${restMin ?? '—'} days. ` : ''}Bars show days left, full at 90 or more.
      </p>
    </MonPanel>
  );
}
