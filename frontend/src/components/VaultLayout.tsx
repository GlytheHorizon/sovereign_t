import React from "react";
import { EntryRow, EntryTable } from "./EntryTable";
import { Sidebar, VaultSection } from "./Sidebar";

interface VaultLayoutProps {
  entries: EntryRow[];
  activeSection: VaultSection;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewEntry: () => void;
  onSelectSection: (section: VaultSection) => void;
  onOpenEntry?: (id: string) => void;
  onCopyUsername?: (id: string) => void;
  onCopyPassword?: (id: string) => void;
  onRevealStart?: (id: string) => void;
  onRevealEnd?: (id: string) => void;
  onToggleFavorite?: (id: string) => void;
  onMoveToTrash?: (id: string) => void;
}

export function VaultLayout({
  entries,
  activeSection,
  searchQuery,
  onSearchChange,
  onNewEntry,
  onSelectSection,
  onOpenEntry,
  onCopyUsername,
  onCopyPassword,
  onRevealStart,
  onRevealEnd,
  onToggleFavorite,
  onMoveToTrash,
}: VaultLayoutProps) {
  return (
    <div className="flex h-screen w-full font-['IBM_Plex_Sans'] text-[var(--color-text-primary)]">
      <Sidebar active={activeSection} onSelect={onSelectSection} />
      <main className="flex flex-1 flex-col bg-[linear-gradient(120deg,rgba(0,122,204,0.08)_0%,rgba(30,30,30,0.98)_40%,rgba(37,37,38,1)_100%)]">
        <header className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
              Sovereigni-T
            </span>
            <span className="text-sm text-[var(--color-text-primary)]">
              Zero-knowledge vault
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              <span>Search</span>
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="title, username, url"
                className="w-48 bg-transparent text-xs text-[var(--color-text-primary)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={onNewEntry}
              className="rounded-[3px] border border-[var(--color-border-strong)] bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              + New Entry
            </button>
          </div>
        </header>
        <section className="flex-1 overflow-auto px-6 py-6">
          <EntryTable
            entries={entries}
            onOpen={onOpenEntry}
            onCopyUsername={onCopyUsername}
            onCopyPassword={onCopyPassword}
            onRevealStart={onRevealStart}
            onRevealEnd={onRevealEnd}
            onToggleFavorite={onToggleFavorite}
            onMoveToTrash={onMoveToTrash}
          />
        </section>
      </main>
    </div>
  );
}
