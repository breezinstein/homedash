import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard as ClipboardIcon,
  Copy,
  Edit2,
  GripVertical,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@ui-sdk/react/button';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { Field, FieldLabel } from '@ui-sdk/react/field';
import { Input } from '@ui-sdk/react/input';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@ui-sdk/react/menu';
import {
  ScrollArea,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@ui-sdk/react/scroll-area';
import { Textarea } from '@ui-sdk/react/textarea';
import {
  SegmentedControl,
  SegmentedControlIndicator,
  SegmentedControlItem,
} from '@ui-sdk/react/segmented-control';
import { useDashboard } from '../context/DashboardContext';
import type { Clip } from '../types';
import { useConfirm, useToast } from './ui';
import { PageHeader, PagePanel } from './shell/PageHeader';

type EditorState =
  | { mode: 'idle' }
  | { mode: 'creating' }
  | { mode: 'editing'; id: string };

const canWebShare =
  typeof navigator !== 'undefined' &&
  typeof (navigator as Navigator).share === 'function';

function formatRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ClipboardManager() {
  const {
    clips,
    addClip,
    updateClip,
    deleteClip,
    toggleClipPin,
    reorderClips,
    copyClipToSystemClipboard,
  } = useDashboard();
  const confirm = useConfirm();
  const toast = useToast();

  const [editor, setEditor] = useState<EditorState>({ mode: 'idle' });
  const [labelDraft, setLabelDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const [query, setQuery] = useState('');
  const [show, setShow] = useState<'all' | 'pinned'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const sortedClips = useMemo(() => {
    // Pinned clips float to the top, otherwise preserve insertion order.
    return [...clips].sort((a, b) => {
      const pa = a.pinned ? 1 : 0;
      const pb = b.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return 0;
    });
  }, [clips]);

  const filteredClips = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = show === 'pinned' ? sortedClips.filter((c) => c.pinned) : sortedClips;
    if (!q) return scoped;
    return scoped.filter(c =>
      c.label.toLowerCase().includes(q) || c.content.toLowerCase().includes(q)
    );
  }, [sortedClips, query, show]);
  const pinnedCount = clips.filter((c) => c.pinned).length;

  const openCreator = () => {
    setLabelDraft('');
    setContentDraft('');
    setEditor({ mode: 'creating' });
  };

  const openEditor = (clip: Clip) => {
    setLabelDraft(clip.label);
    setContentDraft(clip.content);
    setEditor({ mode: 'editing', id: clip.id });
  };

  const cancelEditor = () => {
    setEditor({ mode: 'idle' });
    setLabelDraft('');
    setContentDraft('');
  };

  const saveEditor = () => {
    const trimmedLabel = labelDraft.trim() || 'Untitled';
    if (!contentDraft) {
      cancelEditor();
      return;
    }
    if (editor.mode === 'creating') {
      addClip(trimmedLabel, contentDraft);
      toast.success('Clip added');
    } else if (editor.mode === 'editing') {
      updateClip(editor.id, { label: trimmedLabel, content: contentDraft });
      toast.success('Clip updated');
    }
    cancelEditor();
  };

  const handleCopy = async (clip: Clip) => {
    const ok = await copyClipToSystemClipboard(clip.content);
    if (!ok) {
      toast.error('Copy failed');
      return;
    }
    setCopiedId(clip.id);
    toast.success('Copied to clipboard');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), 1500);
  };

  const handleShare = async (clip: Clip) => {
    if (!canWebShare) return;
    try {
      await (navigator as Navigator).share({ title: clip.label, text: clip.content });
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') toast.error('Share failed');
    }
  };

  const handleDelete = async (clip: Clip) => {
    const ok = await confirm({
      title: 'Delete clip',
      message: `Delete clip "${clip.label}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    deleteClip(clip.id);
    toast.success('Clip deleted');
  };

  // Reorder helpers — they swap a clip with its neighbour in the canonical
  // (unsorted) clips array, so hidden / pinned clips keep their position.
  const moveClip = (clip: Clip, direction: -1 | 1) => {
    const idx = clips.findIndex(c => c.id === clip.id);
    if (idx === -1) return;
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= clips.length) return;
    const next = [...clips];
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    reorderClips(next);
  };

  // Drag reorder against the underlying `clips` array (not the
  // filtered/sorted view) so that hidden or pinned clips keep their position.
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('clip-id', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    if (!draggedId || draggedId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('clip-id') || draggedId;
    setDraggedId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const next = [...clips];
    const fromIdx = next.findIndex(c => c.id === sourceId);
    const toIdx = next.findIndex(c => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    reorderClips(next);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Clipboard"
        description={`${clips.length} saved ${clips.length === 1 ? 'clip' : 'clips'}, synced with the dashboard config.`}
        actions={
          <Button className="ui-btn" data-variant="primary" data-size="sm" onClick={openCreator}>
            <Plus className="size-3.5" aria-hidden="true" /> New clip
          </Button>
        }
      />
      <PagePanel>
        <div className="ui-panel-head gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <Input
              className="ui-input pl-9"
              value={query}
              onValueChange={setQuery}
              placeholder="Search clips…"
              aria-label="Search clips"
            />
          </div>
          <SegmentedControl aria-label="Show" className="ui-seg shrink-0" value={show} onValueChange={(v) => { if (v) setShow(v as 'all' | 'pinned'); }}>
            <SegmentedControlIndicator />
            <SegmentedControlItem value="all" className="ui-seg-item">All <span className="tabular-nums text-[var(--text-tertiary)]">{clips.length}</span></SegmentedControlItem>
            <SegmentedControlItem value="pinned" className="ui-seg-item">Pinned <span className="tabular-nums text-[var(--text-tertiary)]">{pinnedCount}</span></SegmentedControlItem>
          </SegmentedControl>
        </div>

        <ScrollArea className="min-h-0 flex-1" aria-label="Saved clips">
          <ScrollAreaViewport className="p-4">
            <div className="ui-clip-grid">
              {filteredClips.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-3 grid size-14 place-items-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--surface-sunken)]">
                    <ClipboardIcon className="size-6 text-[var(--color-text-secondary)]" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {clips.length === 0 ? 'No clips yet' : show === 'pinned' && !query ? 'Nothing pinned yet' : 'No matches'}
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-[var(--color-text-secondary)]">
                    {clips.length === 0
                      ? 'Save snippets, commands and addresses, then copy them anywhere with one click.'
                      : show === 'pinned' && !query ? 'Pin a clip from its menu to keep it at the top.' : `Nothing matches “${query}”.`}
                  </p>
                  {clips.length === 0 && (
                    <Button className="ui-btn mt-4" data-variant="primary" data-size="sm" onClick={openCreator}>
                      <Plus className="size-3.5" aria-hidden="true" /> Add your first clip
                    </Button>
                  )}
                </div>
              )}

              {filteredClips.map((clip, visibleIdx) => {
                const isCopied = copiedId === clip.id;
                const isDragging = draggedId === clip.id;
                const isDragOver = dragOverId === clip.id;
                const canonicalIdx = clips.findIndex(c => c.id === clip.id);
                const canMoveUp = canonicalIdx > 0;
                const canMoveDown = canonicalIdx !== -1 && canonicalIdx < clips.length - 1;

                return (
                  <div
                    key={clip.id}
                    draggable={!query}
                    onDragStart={(e) => handleDragStart(e, clip.id)}
                    onDragOver={(e) => handleDragOver(e, clip.id)}
                    onDrop={(e) => handleDrop(e, clip.id)}
                    onDragEnd={handleDragEnd}
                    className={`group rounded-[var(--radius-md)] border bg-[var(--surface-sunken)] transition-colors ${
                      isDragOver
                        ? 'border-[var(--color-primary)] ring-2 ring-[color-mix(in_srgb,var(--color-primary)_30%,transparent)]'
                        : clip.pinned
                          ? 'border-[var(--accent-line)]'
                          : 'border-[var(--color-border)]'
                    } ${isDragging ? 'opacity-50' : ''}`}
                  >
                    <div className="flex h-full flex-col gap-2 p-3">
                      <div className="flex items-start gap-2">
                        {!query && (
                          <span className="hidden cursor-grab pt-1 text-[var(--text-tertiary)] opacity-0 transition-opacity group-hover:opacity-100 sm:block" title="Drag to reorder">
                            <GripVertical className="size-4" aria-hidden="true" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {clip.pinned && <Pin className="size-3.5 shrink-0 text-[var(--color-accent)]" aria-label="Pinned" />}
                            <h3 className="truncate text-[0.8125rem] font-semibold text-[var(--color-text-primary)]">{clip.label}</h3>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">{formatRelative(clip.updatedAt)}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          <Button
                            className="ui-btn"
                            data-variant={isCopied ? 'secondary' : 'primary'}
                            data-size="sm"
                            onClick={() => handleCopy(clip)}
                            title="Copy to clipboard"
                          >
                            {isCopied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                            <span className="sr-only sm:not-sr-only">{isCopied ? 'Copied' : 'Copy'}</span>
                          </Button>
                          <Menu
                            onAction={(action) => {
                              if (action === 'share') void handleShare(clip);
                              if (action === 'pin') toggleClipPin(clip.id);
                              if (action === 'up') moveClip(clip, -1);
                              if (action === 'down') moveClip(clip, 1);
                              if (action === 'edit') openEditor(clip);
                              if (action === 'delete') void handleDelete(clip);
                            }}
                          >
                            <MenuTrigger
                              aria-label={`Actions for ${clip.label}`}
                              className="ui-btn"
                              data-variant="ghost"
                              data-size="icon"
                            >
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            </MenuTrigger>
                            <MenuContent className="ui-popup">
                              {canWebShare && (
                                <MenuItem value="share" className="ui-menu-item">
                                  <Share2 className="size-4" aria-hidden="true" /> Share clip
                                </MenuItem>
                              )}
                              <MenuItem value="pin" className="ui-menu-item">
                                {clip.pinned
                                  ? <PinOff className="size-4" aria-hidden="true" />
                                  : <Pin className="size-4" aria-hidden="true" />}
                                {clip.pinned ? 'Unpin' : 'Pin to top'}
                              </MenuItem>
                              <MenuItem value="up" className="ui-menu-item" disabled={!canMoveUp}>
                                <ArrowUp className="size-4" aria-hidden="true" /> Move up
                              </MenuItem>
                              <MenuItem value="down" className="ui-menu-item" disabled={!canMoveDown}>
                                <ArrowDown className="size-4" aria-hidden="true" /> Move down
                              </MenuItem>
                              <MenuItem value="edit" className="ui-menu-item">
                                <Edit2 className="size-4" aria-hidden="true" /> Edit clip
                              </MenuItem>
                              <MenuSeparator className="ui-menu-separator" />
                              <MenuItem value="delete" className="ui-menu-item" data-tone="danger">
                                <Trash2 className="size-4" aria-hidden="true" /> Delete clip
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </div>
                      </div>
                      <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--color-surface)] p-2 font-mono text-xs text-[var(--color-text-secondary)]">
                          {clip.content}
                        </pre>
                    </div>
                    <span className="sr-only">Clip {visibleIdx + 1} of {filteredClips.length}</span>
                  </div>
                );
              })}
            </div>
          </ScrollAreaViewport>
          <ScrollAreaScrollbar orientation="vertical">
            <ScrollAreaThumb />
          </ScrollAreaScrollbar>
        </ScrollArea>
      </PagePanel>

      {editor.mode !== 'idle' && (
        <Dialog open onOpenChange={(open) => { if (!open) cancelEditor(); }}>
          <DialogBackdrop className="ui-dialog-backdrop" />
          <DialogContent className="ui-dialog" data-size="md">
            <div className="ui-dialog-head">
              <div className="min-w-0 flex-1">
                <DialogTitle className="ui-dialog-title">
                  {editor.mode === 'creating' ? 'New clip' : 'Edit clip'}
                </DialogTitle>
                <DialogDescription className="ui-dialog-description">
                  Snippets, commands and addresses, synced with the dashboard config.
                </DialogDescription>
              </div>
              <DialogClose aria-label="Close" className="ui-dialog-close">
                <X className="size-4" aria-hidden="true" />
              </DialogClose>
            </div>
            <div className="ui-dialog-body space-y-3">
              <Field className="ui-field">
                <FieldLabel className="ui-label">Label</FieldLabel>
                <Input
                  className="ui-input"
                  value={labelDraft}
                  onValueChange={setLabelDraft}
                  autoFocus
                  placeholder="e.g. SSH command, API token, address…"
                />
              </Field>
              <Field className="ui-field">
                <FieldLabel className="ui-label">Content</FieldLabel>
                <Textarea
                  className="ui-textarea font-mono"
                  value={contentDraft}
                  onValueChange={setContentDraft}
                  rows={6}
                  placeholder="Paste anything — multiline text, commands, snippets…"
                />
              </Field>
            </div>
            <div className="ui-dialog-foot">
              <DialogClose className="ui-btn" data-variant="secondary">
                Cancel
              </DialogClose>
              <Button
                className="ui-btn"
                data-variant="primary"
                onClick={saveEditor}
                disabled={!contentDraft}
              >
                <Save className="size-3.5" aria-hidden="true" />
                {editor.mode === 'creating' ? 'Add clip' : 'Save changes'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
