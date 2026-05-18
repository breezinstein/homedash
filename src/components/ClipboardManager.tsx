import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard as ClipboardIcon,
  Copy,
  Edit2,
  GripVertical,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { Clip } from '../types';
import { ModalShell, useConfirm, useToast } from './ui';

interface ClipboardManagerProps {
  onClose: () => void;
}

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

export function ClipboardManager({ onClose }: ClipboardManagerProps) {
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Esc inside the editor cancels the editor first. ModalShell's Esc
  // handler is suppressed while we're editing (see `dismissOnEscape` below)
  // so the second press will dismiss the modal.
  useEffect(() => {
    if (editor.mode === 'idle') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setEditor({ mode: 'idle' });
      setLabelDraft('');
      setContentDraft('');
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true } as EventListenerOptions);
  }, [editor.mode]);

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
    if (!q) return sortedClips;
    return sortedClips.filter(c =>
      c.label.toLowerCase().includes(q) || c.content.toLowerCase().includes(q)
    );
  }, [sortedClips, query]);

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
      await (navigator as Navigator).share({
        title: clip.label,
        text: clip.content,
      });
    } catch (err) {
      // AbortError when the user dismisses the share sheet — ignore.
      if ((err as DOMException)?.name !== 'AbortError') {
        toast.error('Share failed');
      }
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
    <ModalShell
      onClose={onClose}
      ariaLabel="Multi-clipboard"
      dismissOnBackdrop={editor.mode === 'idle'}
      dismissOnEscape={editor.mode === 'idle'}
    >
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-3xl shadow-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <ClipboardIcon className="w-5 h-5 text-[var(--color-primary)]" />
          <h2 id="clipboard-title" className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
            Multi-Clipboard
          </h2>
          <span className="text-xs text-[var(--color-text-secondary)] hidden sm:inline">
            ({clips.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 -m-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] active:bg-[var(--color-border)] rounded-lg transition-colors"
          title="Close (Esc)"
          aria-label="Close clipboard"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 border-b border-[var(--color-border)]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clips..."
            className="form-control w-full pl-9 pr-8 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={openCreator}
          disabled={editor.mode === 'creating'}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 active:bg-[var(--color-primary)]/70 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          New Clip
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {/* Editor form */}
        {editor.mode !== 'idle' && (
          <div className="p-3 sm:p-4 bg-[var(--color-background)] rounded-xl border border-[var(--color-primary)]/40 space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Label
              </label>
              <input
                type="text"
                value={labelDraft}
                onChange={(e) => setLabelDraft(e.target.value)}
                autoFocus
                placeholder="e.g. SSH command, API token, address..."
                className="form-control w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Content
              </label>
              <textarea
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                rows={5}
                placeholder="Paste anything — multiline text, commands, snippets..."
                className="form-control w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] resize-y"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEditor}
                className="px-3 py-1.5 bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-border)] active:bg-[var(--color-border)]/80 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditor}
                disabled={!contentDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 active:bg-[var(--color-primary)]/70 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                {editor.mode === 'creating' ? 'Add Clip' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Empty / no-results state */}
        {filteredClips.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-[var(--color-background)] flex items-center justify-center">
              <ClipboardIcon className="w-8 h-8 text-[var(--color-text-secondary)]" />
            </div>
            {clips.length === 0 ? (
              <>
                <p className="text-[var(--color-text-primary)] font-medium mb-1">
                  No clips yet
                </p>
                <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                  Save snippets, commands, addresses — copy them anywhere with one click.
                </p>
                <button
                  onClick={openCreator}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 active:bg-[var(--color-primary)]/70 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Clip
                </button>
              </>
            ) : (
              <>
                <p className="text-[var(--color-text-primary)] font-medium mb-1">No matches</p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Nothing matches "{query}"
                </p>
              </>
            )}
          </div>
        )}

        {/* Clip list */}
        {filteredClips.map((clip, visibleIdx) => {
          const isCopied = copiedId === clip.id;
          const isDragging = draggedId === clip.id;
          const isDragOver = dragOverId === clip.id;
          const canonicalIdx = clips.findIndex(c => c.id === clip.id);
          const canMoveUp = !query && canonicalIdx > 0;
          const canMoveDown = !query && canonicalIdx !== -1 && canonicalIdx < clips.length - 1;
          return (
            <div
              key={clip.id}
              draggable={!query}
              onDragStart={(e) => handleDragStart(e, clip.id)}
              onDragOver={(e) => handleDragOver(e, clip.id)}
              onDrop={(e) => handleDrop(e, clip.id)}
              onDragEnd={handleDragEnd}
              className={`group p-3 sm:p-4 bg-[var(--color-background)] rounded-xl border transition-all ${
                isDragOver
                  ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30'
                  : clip.pinned
                    ? 'border-[var(--color-accent)]/50'
                    : 'border-[var(--color-border)]'
              } ${isDragging ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-2">
                {!query && (
                  <div className="hidden sm:flex flex-col items-center gap-0.5 pt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div
                      className="text-[var(--color-text-secondary)] cursor-grab active:cursor-grabbing"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {clip.pinned && (
                      <Pin className="w-3.5 h-3.5 text-[var(--color-accent)] flex-shrink-0" />
                    )}
                    <h3 className="font-medium text-[var(--color-text-primary)] truncate">
                      {clip.label}
                    </h3>
                    <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                      {formatRelative(clip.updatedAt)}
                    </span>
                  </div>
                  <pre className="text-xs sm:text-sm text-[var(--color-text-secondary)] font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto bg-[var(--color-surface)] rounded-lg p-2 border border-[var(--color-border)]">
                    {clip.content}
                  </pre>
                  {/* Mobile reorder row — visible only when not searching */}
                  {!query && (
                    <div className="flex sm:hidden items-center gap-2 mt-2">
                      <button
                        onClick={() => moveClip(clip, -1)}
                        disabled={!canMoveUp}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] active:bg-[var(--color-border)] rounded-lg text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        aria-label="Move clip up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                        Up
                      </button>
                      <button
                        onClick={() => moveClip(clip, 1)}
                        disabled={!canMoveDown}
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] active:bg-[var(--color-border)] rounded-lg text-xs disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        aria-label="Move clip down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                        Down
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleCopy(clip)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-95 ${
                      isCopied
                        ? 'bg-[var(--color-success)] text-white'
                        : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/80 active:bg-[var(--color-primary)]/70'
                    }`}
                    title="Copy to clipboard"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                  {canWebShare && (
                    <button
                      onClick={() => handleShare(clip)}
                      className="p-2 -m-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:bg-[var(--color-primary)]/20 rounded-lg transition-colors"
                      title="Share"
                      aria-label="Share clip"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => toggleClipPin(clip.id)}
                    className="p-2 -m-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 active:bg-[var(--color-accent)]/20 rounded-lg transition-colors"
                    title={clip.pinned ? 'Unpin' : 'Pin to top'}
                    aria-label={clip.pinned ? 'Unpin clip' : 'Pin clip'}
                  >
                    {clip.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEditor(clip)}
                    className="p-2 -m-0.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 active:bg-[var(--color-primary)]/20 rounded-lg transition-colors"
                    title="Edit"
                    aria-label="Edit clip"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(clip)}
                    className="p-2 -m-0.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 active:bg-[var(--color-error)]/20 rounded-lg transition-colors"
                    title="Delete"
                    aria-label="Delete clip"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* visibleIdx reserved for future a11y announcements */}
              <span className="sr-only">Clip {visibleIdx + 1} of {filteredClips.length}</span>
            </div>
          );
        })}
      </div>
      </div>
    </ModalShell>
  );
}
