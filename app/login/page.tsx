import { redirect } from 'next/navigation';

import { sesionActual } from '@/lib/guard';
import { LoginForm } from '@/components/LoginForm';
import { Icon } from '@/components/Icon';

export const dynamic = 'force-dynamic';

const DEMO = [
  { email: 'admin@sim.local', nombre: 'Ana Administradora', rol: 'Administrador' },
  { email: 'jefe.enoxa@sim.local', nombre: 'Jorge Estrada', rol: 'Jefe · ENOXA' },
  { email: 'jefe.grani@sim.local', nombre: 'Lucía Moreno', rol: 'Jefe · GRANI' },
  { email: 'inv.enoxa.hsa@sim.local', nombre: 'Dr. Martín Salas', rol: 'Médico · ENOXA' },
  { email: 'inv.enoxa.hsb@sim.local', nombre: 'Dra. Paula Ríos', rol: 'Médico · ENOXA' },
  { email: 'inv.grani.hga@sim.local', nombre: 'Dr. Iván Peralta', rol: 'Médico · GRANI' },
];

export default async function LoginPage() {
  const sesion = await sesionActual();
  if (sesion) redirect('/panel');

  return (
    <div className="login-shell">
      <section className="login-brand">
        <span className="ring a" />
        <span className="ring b" />

        <div className="brand">
          <span className="brand-mark">CR</span>
          <span className="brand-text">
            <strong>CRD Farmacovigilancia</strong>
            <span>SIM · Prueba de concepto</span>
          </span>
        </div>

        <div>
          <h1>
            Datos clínicos
            <br />
            <em>con acceso bajo control</em>
          </h1>
          <p className="lead">
            Cuaderno de recogida de datos para farmacovigilancia. Cada rol ve exactamente lo
            que necesita, y cada acceso queda registrado en una pista de auditoría inmutable.
          </p>

          <div className="points">
            <div className="point">
              <span className="tick">1</span>
              <span>
                <strong>Tres roles, responsabilidades separadas.</strong> Administración, supervisión
                del estudio y captura clínica no se mezclan.
              </span>
            </div>
            <div className="point">
              <span className="tick">2</span>
              <span>
                <strong>El ámbito es el estudio.</strong> Un investigador de ENOXA no puede ver ni
                tocar los datos de GRANI.
              </span>
            </div>
            <div className="point">
              <span className="tick">3</span>
              <span>
                <strong>Auditoría encadenada por hash.</strong> La base impide modificar el registro;
                la aplicación puede verificar la cadena completa.
              </span>
            </div>
          </div>
        </div>

        <div className="foot">
          Datos sintéticos · Ningún paciente real · PostgreSQL {''}
          <span className="mono">crd_rbac_poc</span>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <h2>Iniciar sesión</h2>
          <p className="sub">
            Elige una cuenta de demostración o escribe las credenciales.
          </p>
          <LoginForm demoUsers={DEMO} />

          <p className="small muted" style={{ marginTop: 20, display: 'flex', gap: 7 }}>
            <Icon name="lock" size={15} />
            Sesión firmada con HMAC-SHA256. La baja de una asignación surte efecto de inmediato.
          </p>
        </div>
      </section>
    </div>
  );
}
