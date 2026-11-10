import type { ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

export function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  tone?: 'warn' | 'info' | 'danger';
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon ? (
          <span className={`stat-icon${tone ? ` tone-${tone}` : ''}`}>
            <Icon name={icon} size={18} />
          </span>
        ) : null}
      </div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}
