"use client";

import { NotebookPen, Plus, Trash2 } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { CLONES, SPECIALISTS } from "@/lib/clones";
import { MEMORY_LIMIT, MEMORY_MAX_CHARS, useClon } from "@/lib/store";
import type { MemoryNote } from "@/lib/types";
import { timeAgo } from "@/lib/time";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { GlassPanel, SectionHeader } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/States";

type Scope = MemoryNote["scope"];

const SCOPES: { value: Scope; label: string }[] = [
  { value: "all", label: "All clones" },
  ...SPECIALISTS.map((id) => ({ value: id as Scope, label: CLONES[id].short })),
];

const scopeLabel = (scope: Scope) => (scope === "all" ? "All clones" : CLONES[scope].short);
const scopeAccent = (scope: Scope) => (scope === "all" ? CLONES.master.accent : CLONES[scope].accent);

/** A manual source next to the connected apps: facts only the user knows, kept for every clone to use. */
export function MemoryPanel() {
  const memory = useClon((s) => s.memory);
  const addMemory = useClon((s) => s.addMemory);
  const removeMemory = useClon((s) => s.removeMemory);
  const notify = useClon((s) => s.notify);
  const [text, setText] = useState("");
  const [scope, setScope] = useState<Scope>("all");

  const value = text.trim();
  const full = memory.length >= MEMORY_LIMIT;

  const save = () => {
    if (!value || full) return;
    addMemory(value, scope);
    setText("");
    notify({ kind: "update", title: "Saved to your notes", body: `Sent to ${scope === "all" ? "every clone" : scopeLabel(scope)} with your next request.`, href: "/integrations" });
  };

  return (
    <GlassPanel className="mt-6">
      <SectionHeader
        title="Your notes"
        count={memory.length}
        eyebrow="What your connected apps don't know — a friend's email, a preference, a routine. Stays on this device and goes to your clones with every request."
      />

      <div className="grid gap-5 md:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <textarea
            className="field min-h-[112px] resize-y leading-relaxed"
            placeholder="Something CLON should remember…"
            title="Don't store passwords, card numbers or other secrets."
            value={text}
            maxLength={MEMORY_MAX_CHARS}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              }
            }}
            aria-label="Note for CLON to remember"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Segmented<Scope> label="Which clones use this note" size="sm" value={scope} onChange={setScope} options={SCOPES} />
            <Button type="submit" variant="accent" size="sm" className="ml-auto" disabled={!value || full}>
              <Plus className="h-3.5 w-3.5" /> Save
            </Button>
          </div>
          <p className="mt-2 font-mono text-[10px] text-faint" title="Ctrl + Enter to save">
            {full ? `${MEMORY_LIMIT}/${MEMORY_LIMIT} notes — delete one to add another` : `${text.length}/${MEMORY_MAX_CHARS}`}
          </p>
        </form>

        {memory.length === 0 ? (
          <EmptyState icon={NotebookPen} title="No notes yet" />
        ) : (
          <ul className="no-scrollbar max-h-[320px] space-y-2 overflow-y-auto">
            {memory.map((m) => (
              <li
                key={m.id}
                className="group rounded-xl border border-line bg-white/[0.02] px-3 py-2.5"
                style={{ "--accent": scopeAccent(m.scope) } as CSSProperties}
              >
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-soft">{m.text}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone="accent">{scopeLabel(m.scope)}</Badge>
                  <span className="font-mono text-[10px] text-faint">{timeAgo(m.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => removeMemory(m.id)}
                    className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-faint transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Delete note"
                    title="Delete note"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassPanel>
  );
}
