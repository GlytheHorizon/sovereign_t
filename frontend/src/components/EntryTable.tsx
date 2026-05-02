import React from "react";

export interface EntryRow {
  id: string;
  title: string;
  username: string;
  url: string;
  favorite: boolean;
  updatedAt: number;
}

interface EntryTableProps {
  entries: EntryRow[];
  onOpen?: (id: string) => void;
  onCopyUsername?: (id: string) => void;
  onCopyPassword?: (id: string) => void;
  onRevealStart?: (id: string) => void;
  onRevealEnd?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onMoveToTrash?: (id: string) => void;
}

export function EntryTable({
  entries,
  onOpen,
  onCopyUsername,
  onCopyPassword,
  onRevealStart,
  onRevealEnd,
  onToggleFavorite,
  onMoveToTrash,
}: EntryTableProps) {
  return (
    <div className="overflow-hidden rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
      <table className="w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
            <th className="w-[32%] px-4 py-3 text-left">Title</th>
            <th className="w-[22%] px-4 py-3 text-left">Username</th>
            <th className="w-[26%] px-4 py-3 text-left">URL</th>
            <th className="w-[20%] px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className="border-t border-[var(--color-border-subtle)] text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onOpen?.(entry.id)}
                  className="w-full text-left font-medium hover:text-[var(--color-accent)]"
                >
                  {entry.title}
                </button>
              </td>
              <td className="px-4 py-3 font-['JetBrains_Mono'] text-xs text-[var(--color-text-primary)]">
                {entry.username}
              </td>
              <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                {entry.url || "-"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onCopyUsername?.(entry.id)}
                    className="rounded-[3px] border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)]"
                    title="Copy username"
                  >
                    Copy User
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => onRevealStart?.(entry.id)}
                    onMouseUp={() => onRevealEnd?.(entry.id)}
                    onMouseLeave={() => onRevealEnd?.(entry.id)}
                    className="rounded-[3px] border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)]"
                    title="Press and hold to reveal"
                  >
                    Hold Reveal
                  </button>
                  <button
                    type="button"
                    onClick={() => onCopyPassword?.(entry.id)}
                    className="rounded-[3px] border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)]"
                    title="Copy password"
                  >
                    Copy Pass
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite?.(entry.id)}
                    className={`rounded-[3px] border px-2 py-1 text-[11px] transition-colors ${
                      entry.favorite
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border-subtle)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
                    }`}
                    title="Toggle favorite"
                  >
                    Fav
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveToTrash?.(entry.id)}
                    className="rounded-[3px] border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] text-[var(--color-text-primary)] transition-colors hover:border-red-400"
                    title="Move to trash"
                  >
                    Trash
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
