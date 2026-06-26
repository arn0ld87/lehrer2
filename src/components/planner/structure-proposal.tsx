'use client';

import { useState } from 'react';
import { Card, CardHead, Button } from '../ui';
import type { StructurePhase } from '@/lib/types';

/**
 * Vorgeschlagene Struktur — Entwurf, also prüfbar, anpassbar und nicht magisch.
 *
 * `editable` aktiviert den Inline-Bearbeitungsmodus (nur sinnvoll, wenn echte,
 * generierte Statements vorliegen). Bearbeitungen sind lokal (Client-State) —
 * sie ändern die Anzeige, ersetzen aber keine menschliche Letztentscheidung und
 * werden noch nicht serverseitig persistiert.
 */
export function StructureProposal({
  phases,
  editable = false,
}: {
  phases: StructurePhase[];
  editable?: boolean;
}) {
  // Reset bei neuer Generierung erfolgt über den `key`-Prop im Parent (Remount) —
  // daher kein useEffect/setState-in-Effect nötig.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StructurePhase[]>(phases);

  const items = editing ? draft : phases;

  const updateTitle = (id: string, title: string) =>
    setDraft((cur) => cur.map((p) => (p.id === id ? { ...p, title } : p)));

  return (
    <Card>
      <CardHead
        title="Vorgeschlagene Struktur"
        subtitle="Noch ein Entwurf. Also prüfbar, anpassbar und nicht magisch."
        action={
          <Button
            variant="secondary"
            size="small"
            disabled={!editable}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? 'Fertig' : 'Bearbeiten'}
          </Button>
        }
      />
      <div className="grid gap-2">
        {items.length === 0 && (
          <p className="text-[11px] text-muted p-3 border border-line border-dashed rounded-[12px]">
            Noch keine Struktur. Gib oben die Rahmendaten ein und wähle „Struktur vorschlagen“ —
            der quellengestützte Entwurf erscheint dann hier.
          </p>
        )}
        {items.map((p, i) => (
          <div
            key={p.id}
            className="flex items-start gap-2.5 p-3 border border-line rounded-[12px]"
          >
            <span
              aria-hidden
              className="grid place-items-center w-[21px] h-[21px] rounded-[7px] bg-primary-soft text-primary text-[11px] font-extrabold shrink-0"
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              {editing ? (
                <textarea
                  value={p.title}
                  onChange={(e) => updateTitle(p.id, e.target.value)}
                  className="w-full text-[11px] font-bold border border-line-strong bg-surface rounded-[8px] px-2 py-1.5 outline-none focus:border-focus-ring resize-y min-h-[44px]"
                />
              ) : (
                <strong className="block text-[11px]">{p.title}</strong>
              )}
              <span className="block text-[10px] text-muted mt-0.5">{p.detail}</span>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <p className="text-[10px] text-muted-2 mt-2.5">
          Änderungen sind lokal und dienen der Vorschau — die Letztentscheidung bleibt bei dir.
        </p>
      )}
    </Card>
  );
}
