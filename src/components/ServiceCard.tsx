import { memo, useState, useEffect } from 'react';
import type { Service } from '../types';
import { ArrowUpRight, Edit2, GripVertical, MoreHorizontal, Trash2 } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { configApi } from '../api/configApi';
import { useConfirm, useToast } from './ui';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@ui-sdk/react/menu';

interface ServiceCardProps {
  service: Service;
  index: number;
  localIndex: number;
  onEdit: (index: number) => void;
  onDragStart?: (e: React.DragEvent, service: Service, localIndex: number) => void;
  onDragEnd?: () => void;
}

function isExternalIcon(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/uploads/') || url.startsWith('/icons/')) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

function ServiceIcon({ service, url }: { service: Service; url: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  return (
    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[10px] border border-[var(--border-soft)] bg-[var(--surface-sunken)]">
      {!failed && url ? (
        <img src={url} alt="" className="size-6 object-contain" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[0.9375rem] font-semibold text-[var(--color-primary)]">
          {service.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export const ServiceCard = memo(function ServiceCard({ service, index, localIndex, onEdit, onDragStart, onDragEnd }: ServiceCardProps) {
  const { isEditMode, deleteService } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [cachedIconUrl, setCachedIconUrl] = useState<string | null>(null);

  // Cache external icons. Because the proxy result is pinned on the page's
  // first request, a degraded upstream previously produced a one-shot fallback
  // the page never retried. Retry on a short interval until the icon is served
  // from the cache, so the card self-heals without a manual refresh.
  useEffect(() => {
    if (service.icon && isExternalIcon(service.icon)) {
      let cancelled = false;
      let retryTimer: number | undefined;
      const attempt = () => {
        configApi.proxyIcon(service.icon)
          .then(result => {
            if (cancelled) return;
            if (result.url && result.url.startsWith('/icons/')) {
              setCachedIconUrl(result.url);
            } else {
              setCachedIconUrl(null);
              retryTimer = window.setTimeout(attempt, 30_000);
            }
          })
          .catch(() => {
            if (cancelled) return;
            setCachedIconUrl(null);
            retryTimer = window.setTimeout(attempt, 30_000);
          });
      };
      attempt();
      return () => {
        cancelled = true;
        if (retryTimer) window.clearTimeout(retryTimer);
      };
    }
    setCachedIconUrl(service.icon || null);
  }, [service.icon]);

  const displayIconUrl = cachedIconUrl || service.icon;

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    onDragStart?.(e, service, localIndex);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete service',
      message: `Delete "${service.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    deleteService(index);
    toast.success('Service deleted');
  };

  const body = (
    <>
      <ServiceIcon service={service} url={displayIconUrl} />
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[0.8125rem] font-semibold text-[var(--color-text-primary)] ${
            isEditMode ? 'pr-6' : ''
          }`}
        >
          {service.name}
        </span>
        {service.description ? (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-[var(--color-text-secondary)]">
            {service.description}
          </span>
        ) : null}
      </span>
      {!isEditMode && (
        <ArrowUpRight
          className="pointer-events-none absolute right-2.5 top-2.5 size-3.5 text-[var(--color-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      )}
    </>
  );

  if (isEditMode) {
    return (
      <div
        className="svc-card group"
        data-edit
        data-dragging={isDragging || undefined}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="size-3.5" aria-hidden="true" />
        </span>
        <div className="flex w-full items-start gap-3 pl-2">
          {body}
        </div>
        <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Menu
            onAction={(action) => {
              if (action === 'edit') onEdit(index);
              if (action === 'delete') void handleDelete();
            }}
          >
            <MenuTrigger aria-label={`Actions for ${service.name}`} className="ui-btn" data-variant="ghost" data-size="icon">
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent className="ui-popup">
              <MenuItem value="edit" className="ui-menu-item">
                <Edit2 className="size-4" aria-hidden="true" /> Edit service
              </MenuItem>
              <MenuItem value="delete" className="ui-menu-item" data-tone="danger">
                <Trash2 className="size-4" aria-hidden="true" /> Delete service
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
    );
  }

  return (
    <a
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
      className="svc-card group"
    >
      {body}
    </a>
  );
});
