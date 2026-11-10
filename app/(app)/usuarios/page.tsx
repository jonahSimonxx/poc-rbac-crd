import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { SinAcceso } from '@/components/SinAcceso';
import { requireSesion, rolConcede } from '@/lib/guard';
import { auditar } from '@/lib/audit';
import { usuariosAdmin, estudiosParaFormulario } from '@/lib/data';
import { ETIQUETA_ROL, fechaCorta } from '@/lib/format';
import { cambiarEstadoUsuario, crearUsuario } from './actions';

export const dynamic = 'force-dynamic';

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireSesion();

  if (!rolConcede(sesion, 'usuario:read')) {
    await auditar(sesion, 'usuario:read', { tipo: 'usuario', estudioId: null });
    return <SinAcceso mensaje="La gestión de cuentas corresponde al administrador del sistema." />;
  }

  const sp = await searchParams;
  const error = uno(sp.error);
  const ok = uno(sp.ok);

  const usuarios = await usuariosAdmin();
  const estudios = await estudiosParaFormulario(sesion);

  return (
    <>
      <PageHeader
        eyebrow="Administración"
        title="Usuarios"
        subtitle="Cuentas del sistema y sus asignaciones activas. Una cuenta sin asignación no accede a ningún estudio."
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
          <h3>Cuentas</h3>
          <span className="hint">{usuarios.length} usuarios</span>
        </div>

        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Roles / estudios</th>
                <th>Estado</th>
                <th>Creado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u: any) => {
                const asignaciones = (u.asignaciones ?? []) as Array<{
                  rol: string;
                  estudio: string | null;
                }>;
                return (
                  <tr key={u.id}>
                    <td className="strong">
                      {u.nombre}
                      {u.id === sesion.usuario.id ? (
                        <span className="muted tiny"> · tú</span>
                      ) : null}
                    </td>
                    <td className="mono small">{u.email}</td>
                    <td>
                      {asignaciones.length === 0 ? (
                        <span className="muted small">Sin asignación activa</span>
                      ) : (
                        <div className="row" style={{ gap: 6 }}>
                          {asignaciones.map((a, i) => (
                            <Badge key={i} tone="brand">
                              {ETIQUETA_ROL[a.rol as keyof typeof ETIQUETA_ROL] ?? a.rol}
                              {a.estudio ? ` · ${a.estudio}` : ''}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      {u.activo ? (
                        <Badge tone="ok" dot>
                          Activo
                        </Badge>
                      ) : (
                        <Badge tone="danger" dot>
                          Inactivo
                        </Badge>
                      )}
                    </td>
                    <td className="muted nowrap">{fechaCorta(u.creado_en)}</td>
                    <td>
                      {u.id === sesion.usuario.id ? null : (
                        <form action={cambiarEstadoUsuario}>
                          <input type="hidden" name="usuarioId" value={u.id} />
                          <input type="hidden" name="activar" value={u.activo ? 'false' : 'true'} />
                          <button
                            className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-ghost'}`}
                            type="submit"
                          >
                            {u.activo ? 'Desactivar' : 'Reactivar'}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Crear usuario</h3>
          <span className="hint">La asignación se crea junto con la cuenta</span>
        </div>
        <div className="card-body">
          <form action={crearUsuario} className="form">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="nombre">Nombre completo *</label>
                <input id="nombre" name="nombre" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="email">Correo *</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div className="field">
                <label htmlFor="password">Contraseña inicial *</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                />
                <span className="help">Mínimo 8 caracteres. Se guarda con scrypt.</span>
              </div>
              <div className="field">
                <label htmlFor="rol">Rol *</label>
                <select id="rol" name="rol" required defaultValue="medico-investigador">
                  <option value="medico-investigador">Médico investigador</option>
                  <option value="jefe-estudio">Jefe de estudio</option>
                  <option value="sys-admin">Administrador (global)</option>
                </select>
              </div>
              <div className="field span-2">
                <label htmlFor="estudioId">Estudio para la asignación</label>
                <select id="estudioId" name="estudioId" defaultValue={estudios[0]?.id ?? ''}>
                  <option value="">— Sin estudio (solo administrador) —</option>
                  {estudios.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo} · {e.nombre}
                    </option>
                  ))}
                </select>
                <span className="help">
                  Obligatorio para jefe de estudio y médico investigador. El administrador es global.
                </span>
              </div>
            </div>
            <div>
              <button className="btn btn-primary" type="submit">
                <Icon name="plus" size={16} /> Crear usuario
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
