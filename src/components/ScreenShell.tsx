import type { ReactNode } from 'react';

type Props = { title: string; phase?: number; children?: ReactNode };

/** The heading every screen starts with; a shell says which phase fills it. */
export function ScreenShell({ title, phase, children }: Props) {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {children ?? <p className="text-ink-muted">Arrives in Phase {phase}.</p>}
    </section>
  );
}
