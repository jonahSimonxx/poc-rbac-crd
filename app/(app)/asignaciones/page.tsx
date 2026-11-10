import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { SinAcceso } from '@/components/SinAcceso';
import { requireSesion, rolConcede, esGlobal } from '@/lib/guard';
import { auditar } from '@/lib/audit';
import {
  asignacionesDe,
  estudiosParaFormulario,
  usuariosParaAsignar,
} from '@/lib/data';
import { ETIQUETA_ROL, fechaCorta } from '@/lib/format';
import { crearAsignacion, revocarAsignacion } from './actions';

export const dynamic = 'force-dynamic';

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AsignacionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireSesion();

  if (!rolConcede(sesion, 'asignacion:read')) {
    await auditar(sesion, 'asignacion:read', { tipo: 'asignacion', estudioId: null });
    return <SinAcceso mensaje="No tienes permiso para ver las asignaciones." />;
  }

  const sp = await searchParams;
  const error = uno(sp.error);
  const ok = uno(sp.ok);
  const global = esGlobal(sesion);

  const asignaciones = await asignacionesDe(sesion);
  const usuarios = await usuariosParaAsignar();
  const estudios = await estudiosParaFormulario(sesion);

  const activas = asignaciones.filter((a: any) => a.activa).length;
  const rolesPosibles = global
    ? [
        { valor: 'medico-investigador', texto: 'Médico investigador' },
        { valor: 'jefe-estudio', texto: 'Jefe de estudio' },
      ]
    : [{ valor: 'medico-investigador', texto: 'Médico investigador' }];

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Asignaciones"
        subtitle="Cada asignación une un usuario, un estudio y un rol. Sin asignación activa, no hay acceso. Nadie puede asignarse a sí mismo."
        actions={
          <Badge tone="brand">
            {activas} activas de {asignaciones.length}
          </Badge>
        }
      />

      {error ? (
        <div className="notice notice-error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      ) : null}
      {ok ? (
        <div className="notice notice-ok">
          <Icon name="check" size={16} />
          <span>{ok}</span>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head">
          <h3>Asignaciones registradas</h3>
          <span className="hint">Una activa por usuario y estudio</span>
        </div>

        {asignaciones.length === 0 ? (
          <div className="empty">Sin asignaciones.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Estudio</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Creada</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {asignaciones.map((a: any) => {
                  const propia = a.usuario_id === sesion.usuario.id;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="strong">{a.nombre}</div>
                        <div className="muted tiny mono">{a.email}</div>
                      </td>
                      <td>
                        {a.estudio ? (
                          <Badge tone="brand">{a.estudio}</Badge>
                        ) : (
                          <Badge tone="neutral">Global</Badge>
                        )}
                      </td>
                      <td>{ETIQUETA_ROL[a.rol_codigo as keyof typeof ETIQUETA_ROL] ?? a.rol_codigo}</td>
                      <td>
                        {a.activa ? (
                          <Badge tone="ok" dot>
                            Activa
                          </Badge>
                        ) : (
                          <Badge tone="neutral" dot>
                            Baja
                          </Badge>
                        )}
                      </td>
                      <td className="muted nowrap">{fechaCorta(a.creada_en)}</td>
                      <td>
                        {a.activa && !propia ? (
                          <form action={revocarAsignacion}>
                            <input type="hidden" name="asignacionId" value={a.id} />
                            <button className="btn btn-danger btn-sm" type="submit">
                              Revocar
                            </button>
                          </form>
                        ) : propia && a.activa ? (
                          <span className="muted tiny">Tu propia asignación</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Nueva asignación</h3>
          <span className="hint">
            {global
              ? 'El administrador puede asignar jefes y médicos.'
              : 'El jefe de estudio asigna médicos investigadores de sus estudios.'}
          </span>
        </div>
        <div className="card-body">
          <form action={crearAsignacion} className="form">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="usuarioId">Usuario *</label>
                <select id="usuarioId" name="usuarioId" required defaultValue="">
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  {usuarios
                    .filter((u: any) => u.id !== sesion.usuario.id)
                    .map((u: any) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} · {u.email}
                      </option>
                    ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="estudioId">Estudio *</label>
                <select id="estudioId" name="estudioId" required defaultValue={estudios[0]?.id ?? ''}>
                  {estudios.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo} · {e.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field span-2">
                <label htmlFor="rol">Rol *</label>
                <select id="rol" name="rol" required defaultValue="medico-investigador">
                  {rolesPosibles.map((r) => (
                    <option key={r.valor} value={r.valor}>
                      {r.texto}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="notice notice-info" style={{ marginBottom: 0 }}>
              <Icon name="lock" size={16} />
              <span>
                No puedes asignarte a ti mismo. Si eres jefe de estudio y creas un estudio nuevo, la
                asignación la confirma un administrador.
              </span>
            </div>
            <div>
              <button className="btn btn-primary" type="submit">
                <Icon name="plus" size={16} /> Crear asignación
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
