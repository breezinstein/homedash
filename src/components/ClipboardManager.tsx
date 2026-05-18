import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
  Trash2,
  X,
} from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import type { Clip } from '../types';

interface ClipboardManagerProps {
  onClose: () => void;
}

type EditorState =
  | { mode: 'idle' }
  | { mode: 'creating' }
  | { mode: 'editing'; id: string };

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

  const [editor, setEditor] = useState<EditorState>({ mode: 'idle' });
  const [labelDraft, setLabelDraft] = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on Escape (but only when not in the editor, so users can press Esc
  // to cancel the form first).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (editor.mode !== 'idle') {
        setEditor({ mode: 'idle' });
        setLabelDraft('');
        setContentDraft('');
        return;
      }
      onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editor.mode, onClose]);

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
      // Nothing to save — treat as cancel rather than create an empty clip.
      cancelEditor();
      return;
    }
    if (editor.mode === 'creating') {
      addClip(trimmedLabel, contentDraft);
    } else if (editor.mode === 'editing') {
      updateClip(editor.id, { label: trimmedLabel, content: contentDraft });
    }
    cancelEditor();
  };

  const handleCopy = async (clip: Clip) => {
    const ok = await copyClipToSystemClipboard(clip.content);
    if (!ok) return;
    setCopiedId(clip.id);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDelete = (clip: Clip) => {
    if (!window.confirm(`Delete clip "${clip.label}"?`)) return;
    deleteClip(clip.id);
  };

  // Drag reorder works against the underlying `clips` array (not the
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <ClipboardIcon className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
              Multi-Clipboard
            </h2>
            <span className="text-xs text-[var(--color-text-secondary)] hidden sm:inline">
              ({clips.length})
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background)] rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-2 p-3 sm:p-4 border-b border-[var(--color-border)]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clips..."
              className="w-full pl-9 pr-8 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={openCreator}
            disabled={editor.mode === 'creating'}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)]"
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
                  className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] resize-y"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEditor}
                  className="px-3 py-1.5 bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-border)] transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditor}
                  disabled={!contentDraft}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary)]/80 transition-colors text-sm"
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
          {filteredClips.map(clip => {
            const isCopied = copiedId === clip.id;
            const isDragging = draggedId === clip.id;
            const isDragOver = dragOverId === clip.id;
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
                    <div
                      className="pt-0.5 text-[var(--color-text-secondary)] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
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
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleCopy(clip)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isCopied
                          ? 'bg-[var(--color-success)] text-white'
                          : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/80'
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
                    <button
                      onClick={() => toggleClipPin(clip.id)}
                      className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 rounded-lg transition-colors"
                      title={clip.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      {clip.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditor(clip)}
                      className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(clip)}
                      className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
