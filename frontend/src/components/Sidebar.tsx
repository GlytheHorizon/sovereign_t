import React from "react";

export type VaultSection = "all" | "favorites" | "trash";

interface SidebarProps {
  active: VaultSection;
  onSelect: (section: VaultSection) => void;
}

const sections: Array<{ id: VaultSection; label: string; subtitle: string }> = [
  { id: "all", label: "All", subtitle: "Every entry" },
  { id: "favorites", label: "Favorites", subtitle: "Pinned entries" },
  { id: "trash", label: "Trash", subtitle: "Recently removed" },
];

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside className="flex h-full w-[240px] flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)]">
      <div className="px-4 py-5 text-xs uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        Vault
      </div>
      <nav className="px-2">
        {sections.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={isActive ? "page" : undefined}
              className={`mb-1 flex w-full items-center justify-between rounded-[3px] border px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-[var(--color-border-strong)] bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border-subtle)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">{section.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {section.subtitle}
                </span>
              </div>
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive
                    ? "bg-[var(--color-accent)]"
                    : "bg-[var(--color-border-subtle)]"
                }`}
              />
            </button>
          );
        })}
      </nav>
      <div className="mt-auto px-4 pb-4 text-xs text-[var(--color-text-muted)]">
        Local-first, zero-knowledge.
      </div>
    </aside>
  );
}
