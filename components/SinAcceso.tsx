import Link from 'next/link';

import { Icon } from './Icon';

export function SinAcceso({
  mensaje = 'Tu rol no tiene permiso para ver esta sección.',
}: {
  mensaje?: string;
}) {
  return (
    <div className="card pad" style={{ textAlign: 'center', padding: '56px 24px' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          margin: '0 auto 16px',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--danger-soft)',
          color: 'var(--danger)',
        }}
      >
        <Icon name="lock" size={26} />
      </div>
      <h2 style={{ fontSize: 20 }}>Acceso restringido</h2>
      <p style={{ color: 'var(--muted)', maxWidth: 460, margin: '8px auto 18px' }}>{mensaje}</p>
      <p className="small muted" style={{ marginBottom: 18 }}>
        El intento queda registrado en la auditoría del sistema.
      </p>
      <Link href="/panel" className="btn btn-ghost">
        Volver al panel
      </Link>
    </div>
  );
}
