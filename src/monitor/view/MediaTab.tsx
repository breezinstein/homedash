import { Clapperboard, Download, Film, Pause, Tv } from 'lucide-react';
import type { ArrSnapshot, MediaSnapshot, MediaStream, SeerrIssue, SeerrSnapshot, UsenetSnapshot } from '../../types';
import { InlineAlert, LevelMeter } from '../../components/ui';
import { formatByteRate, formatEta, formatMegabytes, parseEtaLabel } from '../format';
import { Chip, Dot, Empty, MonPanel, Row, timeAgo } from './parts';

const PLAY_METHOD: Record<MediaStream['playMethod'], string> = {
  DirectPlay: 'Direct play',
  DirectStream: 'Direct stream',
  Transcode: 'Transcode',
};

const ISSUE_TYPE: Record<number, string> = { 1: 'Video', 2: 'Audio', 3: 'Subtitles', 4: 'Other' };
const APP_NAME: Record<string, string> = { sabnzbd: 'SABnzbd', nzbget: 'NZBGet', sonarr: 'Sonarr', radarr: 'Radarr' };
const appName = (name: string, type: string) => name?.trim() || APP_NAME[type] || type;

interface MediaTabProps {
  media: MediaSnapshot | null;
  usenet: UsenetSnapshot | null;
  arr: ArrSnapshot | null;
  seerr: SeerrSnapshot | null;
}

/** Streams, downloads, Sonarr/Radarr and requests in four panels. */
export function MediaTab({ media, usenet, arr, seerr }: MediaTabProps) {
  return (
    <div className="mv-grid-2">
      <StreamsPanel media={media} />
      <DownloadsPanel usenet={usenet} />
      <ArrPanel arr={arr} />
      <RequestsPanel seerr={seerr} />
    </div>
  );
}

function StreamsPanel({ media }: { media: MediaSnapshot | null }) {
  if (!media) {
    return <MonPanel title="Now playing" icon={Tv}><Empty>Add Jellyfin or Emby in Settings → Media streams.</Empty></MonPanel>;
  }
  return (
    <MonPanel
      title="Now playing"
      icon={Tv}
      actions={
        <>
          <Chip tone="info">{media.activeStreams} {media.activeStreams === 1 ? 'stream' : 'streams'}</Chip>
          {media.transcoding > 0 && <Chip tone="warning">{media.transcoding} transcoding</Chip>}
        </>
      }
    >
      {media.status === 'down' && <InlineAlert tone="warning" className="mv-inset">{media.error || 'Media server unreachable.'}</InlineAlert>}
      {media.streams.length === 0 ? (
        <Empty>Nothing is playing.</Empty>
      ) : (
        media.streams.map((s, i) => (
          <div key={`${s.server}-${s.user}-${s.title}-${i}`} className="mv-item" data-dim={s.paused || undefined}>
            <div className="mv-item-head">
              <span className="mv-item-title">{s.title}</span>
              {s.paused && <Chip><Pause className="size-2.5" aria-hidden="true" /> Paused</Chip>}
              <Chip tone={s.playMethod === 'Transcode' ? 'warning' : 'success'}>{PLAY_METHOD[s.playMethod] ?? s.playMethod}</Chip>
            </div>
            {(s.subtitle || s.transcodeDetail) && (
              <p className="mv-item-sub">{[s.subtitle, s.transcodeDetail].filter(Boolean).join(' · ')}</p>
            )}
            <LevelMeter
              label={`${s.user} · ${s.client}${s.device ? ` · ${s.device}` : ''}`}
              value={s.progressPercent}
              valueText={s.positionLabel || undefined}
              valueLabel={s.progressPercent != null ? `${Math.round(s.progressPercent)}% watched` : undefined}
              level="ok"
            />
          </div>
        ))
      )}
    </MonPanel>
  );
}

function DownloadsPanel({ usenet }: { usenet: UsenetSnapshot | null }) {
  if (!usenet || usenet.instances.length === 0) {
    return <MonPanel title="Downloads" icon={Download}><Empty>Add SABnzbd or NZBGet in Settings → Usenet queues.</Empty></MonPanel>;
  }
  const total = usenet.instances.reduce((s, i) => s + (i.paused ? 0 : i.speedBps ?? 0), 0);
  return (
    <MonPanel title="Downloads" icon={Download} actions={<Chip tone={total > 0 ? 'info' : undefined}>{formatByteRate(total, '0 B/s')}</Chip>}>
      {usenet.instances.map((inst) => (
        <div key={`${inst.type}-${inst.name}`}>
          <div className="mv-inst">
            <Dot tone={inst.status === 'down' ? 'danger' : inst.paused ? 'muted' : 'success'} />
            <b>{appName(inst.name, inst.type)}</b>
            {inst.paused && <Chip>Paused</Chip>}
            {inst.status === 'down' && <Chip tone="danger">Unreachable</Chip>}
            <span className="mv-inst-meta">
              {[
                !inst.paused && inst.speedBps ? formatByteRate(inst.speedBps) : null,
                inst.etaSeconds ? `ETA ${formatEta(inst.etaSeconds).replace(' left', '')}` : null,
                `${inst.queuedTotal} queued`,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
          {inst.slots.slice(0, 4).map((slot) => {
            const size = slot.sizeMb != null ? formatMegabytes(slot.sizeMb) : '';
            const done = slot.sizeMb != null && slot.remainingMb != null ? formatMegabytes(slot.sizeMb - slot.remainingMb) : '';
            return (
              <div key={`${inst.type}-${inst.name}-${slot.name}`} className="mv-item">
                <div className="mv-item-head">
                  <span className="mv-item-title mv-mono">{slot.name}</span>
                  <Chip tone={/download/i.test(slot.status) ? 'info' : undefined}>{slot.status}</Chip>
                </div>
                <LevelMeter label={size ? `${done || '0 MB'} of ${size}` : 'Progress'} value={slot.percent} level="ok" />
              </div>
            );
          })}
          {inst.slots.length > 4 && <p className="mv-empty">+{inst.slots.length - 4} more in the queue</p>}
        </div>
      ))}
    </MonPanel>
  );
}

function ArrPanel({ arr }: { arr: ArrSnapshot | null }) {
  if (!arr || arr.instances.length === 0) {
    return <MonPanel title="Sonarr / Radarr" icon={Film}><Empty>Add Sonarr or Radarr in Settings → Sonarr / Radarr.</Empty></MonPanel>;
  }
  const warnings = arr.instances.flatMap((i) => i.healthWarnings.map((w) => ({ inst: appName(i.name, i.type), w })));
  return (
    <MonPanel
      title="Sonarr / Radarr"
      icon={Film}
      actions={warnings.length ? <Chip tone="warning">{warnings.length} health {warnings.length === 1 ? 'warning' : 'warnings'}</Chip> : <Chip tone="success">Healthy</Chip>}
    >
      <div className="mv-inst-grid">
        {arr.instances.map((inst) => (
          <div key={`${inst.type}-${inst.name}`} className="mv-inst-card" data-tone={inst.status === 'down' ? 'danger' : inst.healthOk ? undefined : 'warning'}>
            <div className="mv-item-head">
              <b className="mv-item-title">{appName(inst.name, inst.type)}</b>
              {inst.status === 'down'
                ? <Chip tone="danger">Unreachable</Chip>
                : inst.healthOk ? <Chip tone="success">Healthy</Chip>
                : <Chip tone="warning">{inst.healthWarnings.length} {inst.healthWarnings.length === 1 ? 'warning' : 'warnings'}</Chip>}
            </div>
            <dl className="mv-pairs">
              <div><dt>Queue</dt><dd>{inst.queueCount}</dd></div>
              <div><dt>Missing</dt><dd>{inst.wantedCount}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      {warnings.slice(0, 3).map(({ inst, w }) => (
        <InlineAlert key={`${inst}-${w}`} tone="warning" className="mv-inset">
          <b>{inst}:</b> {w}
        </InlineAlert>
      ))}
      {arr.queue.length === 0 ? (
        <Empty>The download queue is empty.</Empty>
      ) : (
        arr.queue.slice(0, 5).map((q, i) => (
          <Row
            key={`${q.instance}-${q.title}-${i}`}
            title={q.seriesName ? `${q.seriesName} · ${q.title}` : q.title}
            sub={[q.instance || APP_NAME[q.instanceType], q.quality, q.sizeMb != null ? formatMegabytes(q.sizeMb) : null, parseEtaLabel(q.timeLeft) ? `${parseEtaLabel(q.timeLeft)} left` : q.status].filter(Boolean).join(' · ')}
            trail={q.progressPercent != null ? <span className="mv-num">{Math.round(q.progressPercent)}%</span> : <Chip>{q.status}</Chip>}
          />
        ))
      )}
    </MonPanel>
  );
}

function RequestsPanel({ seerr }: { seerr: SeerrSnapshot | null }) {
  if (!seerr) {
    return <MonPanel title="Requests" icon={Clapperboard}><Empty>Add Overseerr or Jellyseerr in Settings → Media requests.</Empty></MonPanel>;
  }
  const openIssues = seerr.issues.filter((i) => i.status === 'open');
  return (
    <MonPanel
      title="Requests"
      icon={Clapperboard}
      actions={
        <>
          <Chip tone={seerr.pending.length ? 'info' : undefined}>{seerr.pending.length} pending</Chip>
          {seerr.failed.length > 0 && <Chip tone="danger">{seerr.failed.length} failed</Chip>}
          {openIssues.length > 0 && <Chip tone="warning">{openIssues.length} {openIssues.length === 1 ? 'issue' : 'issues'}</Chip>}
        </>
      }
    >
      {seerr.status === 'down' && <InlineAlert tone="warning" className="mv-inset">{seerr.error || 'Seerr unreachable.'}</InlineAlert>}
      {seerr.pending.length + seerr.failed.length + openIssues.length === 0 && <Empty>No requests waiting and no open issues.</Empty>}
      {seerr.pending.length > 0 && <h4 className="mv-subhead">Waiting for approval</h4>}
      {seerr.pending.slice(0, 4).map((r) => (
        <Row
          key={`p-${r.id}`}
          title={r.mediaTitle}
          sub={`${r.mediaType === 'tv' ? 'TV' : 'Movie'} · ${r.requestedBy}${r.createdAt ? ` · ${timeAgo(r.createdAt)}` : ''}`}
          trail={<>{r.is4k && <Chip tone="info">4K</Chip>}<Chip>Pending</Chip></>}
        />
      ))}
      {seerr.failed.length > 0 && <h4 className="mv-subhead">Failed</h4>}
      {seerr.failed.slice(0, 3).map((r) => (
        <Row
          key={`f-${r.id}`}
          title={r.mediaTitle}
          sub={`${r.mediaType === 'tv' ? 'TV' : 'Movie'} · ${r.requestedBy}${r.createdAt ? ` · ${timeAgo(r.createdAt)}` : ''}`}
          trail={<>{r.is4k && <Chip tone="info">4K</Chip>}<Chip tone="danger">Failed</Chip></>}
        />
      ))}
      {openIssues.length > 0 && <h4 className="mv-subhead">Open issues</h4>}
      {openIssues.slice(0, 4).map((i: SeerrIssue) => (
        <Row
          key={`i-${i.id}`}
          title={i.mediaTitle}
          sub={`${ISSUE_TYPE[i.issueType] ?? 'Issue'} · ${i.createdBy}${i.createdAt ? ` · ${timeAgo(i.createdAt)}` : ''}`}
          trail={<Chip tone="warning">{ISSUE_TYPE[i.issueType] ?? 'Issue'}</Chip>}
        />
      ))}
    </MonPanel>
  );
}
