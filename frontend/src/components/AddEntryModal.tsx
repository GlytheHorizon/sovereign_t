import React, { useMemo, useState } from "react";

export interface NewEntryForm {
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

interface AddEntryModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (entry: NewEntryForm) => void;
  onGeneratePassword?: (length: number, numbers: boolean, symbols: boolean) => Promise<string>;
}

const emptyForm: NewEntryForm = {
  title: "",
  url: "",
  username: "",
  password: "",
  notes: "",
};

export function AddEntryModal({
  open,
  onClose,
  onCreate,
  onGeneratePassword,
}: AddEntryModalProps) {
  const [form, setForm] = useState<NewEntryForm>(emptyForm);
  const [reveal, setReveal] = useState(false);
  const [length, setLength] = useState(16);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);

  const isValid = useMemo(() => {
    return form.title.trim().length > 0 && form.password.trim().length >= 12;
  }, [form.title, form.password]);

  if (!open) {
    return null;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreate({
      title: form.title.trim(),
      url: form.url.trim(),
      username: form.username.trim(),
      password: form.password,
      notes: form.notes,
    });
    setForm(emptyForm);
  };

  const handleGenerate = async () => {
    if (!onGeneratePassword) {
      return;
    }
    const generated = await onGeneratePassword(
      length,
      includeNumbers,
      includeSymbols,
    );
    setForm((prev) => ({ ...prev, password: generated }));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-[520px] rounded-[6px] border border-[var(--color-border-strong)] bg-[var(--color-bg-secondary)] shadow-[0_30px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              New Entry
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Fields are encrypted locally before writing to disk.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[3px] border border-[var(--color-border-subtle)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
          >
            Esc
          </button>
        </div>
        <form className="space-y-4 px-5 py-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              Title
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, title: event.target.value }))
                }
                className="rounded-[3px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              URL
              <input
                value={form.url}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, url: event.target.value }))
                }
                className="rounded-[3px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            Username
            <input
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              className="rounded-[3px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            Password
            <div className="flex gap-2">
              <input
                type={reveal ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                className="flex-1 rounded-[3px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              <button
                type="button"
                onMouseDown={() => setReveal(true)}
                onMouseUp={() => setReveal(false)}
                onMouseLeave={() => setReveal(false)}
                className="rounded-[3px] border border-[var(--color-border-subtle)] px-3 py-2 text-xs text-[var(--color-text-primary)]"
              >
                Hold
              </button>
            </div>
          </label>
          <div className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
            <div className="flex items-center gap-2">
              <span>Length</span>
              <input
                type="number"
                min={12}
                max={32}
                value={length}
                onChange={(event) => setLength(Number(event.target.value))}
                className="w-16 rounded-[3px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-secondary)] px-2 py-1 text-xs text-[var(--color-text-primary)]"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeNumbers}
                onChange={(event) => setIncludeNumbers(event.target.checked)}
              />
              Numbers
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={includeSymbols}
                onChange={(event) => setIncludeSymbols(event.target.checked)}
              />
              Symbols
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              className="ml-auto rounded-[3px] border border-[var(--color-border-strong)] px-3 py-1 text-xs text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent)]"
            >
              Generate
            </button>
          </div>
          <label className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
            Notes
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, notes: event.target.value }))
              }
              rows={4}
              className="rounded-[3px] border border-[var(--color-border-subtle)] bg-[var(--color-bg-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none"
            />
          </label>
          <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-4">
            <span className="text-xs text-[var(--color-text-muted)]">
              Passwords are never stored in plaintext.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[3px] border border-[var(--color-border-subtle)] px-4 py-2 text-xs text-[var(--color-text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid}
                className="rounded-[3px] border border-[var(--color-border-strong)] bg-[var(--color-accent)] px-4 py-2 text-xs text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
