import type { ReactNode } from 'react';

export type BadgeTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'brand';

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}
