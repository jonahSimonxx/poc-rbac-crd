import Link from 'next/link';

import { requireSesion, rolConcede, rolesDe, esGlobal } from '@/lib/guard';
import { Nav, type NavItem } from '@/components/Nav';
import { Icon } from '@/components/Icon';
import { ETIQUETA_ROL, inicialesDe } from '@/lib/format';
import { logout } from './sesion-actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireSesion();

  const items: NavItem[] = [{ href: '/panel', label: 'Panel', icon: 'grid' }];

  if (rolConcede(sesion, 'paciente:read')) {
    items.push({ href: '/pacientes', label: 'Pacientes', icon: 'users' });
  }
  if (rolConcede(sesion, 'estudio:read')) {
    items.push({ href: '/estudios', label: 'Estudios', icon: 'flask' });
  }
  if (rolConcede(sesion, 'usuario:read')) {
    items.push({ href: '/usuarios', label: 'Usuarios', icon: 'shield' });
  }
  if (rolConcede(sesion, 'asignacion:read')) {
    items.push({ href: '/asignaciones', label: 'Asignaciones', icon: 'link' });
  }
  if (rolConcede(sesion, 'auditoria_clinica:read') || rolConcede(sesion, 'auditoria_admin:read')) {
    items.push({ href: '/auditoria', label: 'Auditoría', icon: 'clipboard' });
  }

  const roles = rolesDe(sesion);
  const rolPrincipal = roles.length > 0 ? ETIQUETA_ROL[roles[0]] : 'Sin rol';
  const ambito = esGlobal(sesion)
    ? 'Acceso global'
    : sesion.estudios.map((e) => e.codigo).join(' · ') || 'Sin estudio';

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/panel" className="brand">
          <span className="brand-mark">CR</span>
          <span className="brand-text">
            <strong>CRD Farmacovigilancia</strong>
            <span>POC · Control de acceso</span>
          </span>
        </Link>

        <div>
          <div className="nav-label">Navegación</div>
          <Nav items={items} />
        </div>

        <div className="sidebar-foot">
          <div className="user-chip">
            <span className="avatar">{inicialesDe(sesion.usuario.nombre)}</span>
            <span className="who">
              <strong>{sesion.usuario.nombre}</strong>
              <span>
                {rolPrincipal} · {ambito}
              </span>
            </span>
          </div>
          <form action={logout}>
            <button className="btn btn-ghost btn-block btn-sm" type="submit">
              <Icon name="logout" size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="main">
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
