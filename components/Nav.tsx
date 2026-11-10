'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Icon, type IconName } from './Icon';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={active ? 'active' : undefined}>
            <span className="nav-icon">
              <Icon name={item.icon} size={18} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
