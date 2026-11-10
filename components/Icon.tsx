import type { ReactNode } from 'react';

export type IconName =
  | 'grid'
  | 'users'
  | 'flask'
  | 'shield'
  | 'link'
  | 'clipboard'
  | 'logout'
  | 'plus'
  | 'check'
  | 'alert'
  | 'lock'
  | 'search'
  | 'pen'
  | 'ban'
  | 'building'
  | 'pill'
  | 'activity'
  | 'file';

const TRAZOS: Record<IconName, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 6.2" />
      <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6" />
      <path d="M10 3v6l-5.5 9.2A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.8L14 9V3" />
      <path d="M7.5 14h9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v5.5c0 4.3 3 7.6 7.5 9.5 4.5-1.9 7.5-5.2 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  link: (
    <>
      <path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7L11.5 6.3" />
      <path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.3-1.3" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4a2 2 0 0 1 6 0" />
      <path d="M8.5 10h7M8.5 14h7M8.5 18h4" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="M10 8l-4 4 4 4" />
      <path d="M6 12h9" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 6.5" />,
  alert: (
    <>
      <path d="M12 3.5 21 20H3l9-16.5Z" />
      <path d="M12 10v4.5M12 17.5v.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <path d="M12 14v2.5" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20h4l11-11a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m13.5 6.5 3 3" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m6 6 12 12" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      <path d="M10 20.5v-3h4v3" />
    </>
  ),
  pill: (
    <>
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-40 12 12)" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
  file: (
    <>
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[name]}
    </svg>
  );
}
