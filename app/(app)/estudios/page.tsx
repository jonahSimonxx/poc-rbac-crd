import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { requireSesion, esGlobal, rolConcede } from '@/lib/guard';
import { estudiosDe, sitiosDe } from '@/lib/data';
import { crearEstudio } from './actions';

export const dynamic = 'force-dynamic';

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function EstudiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireSesion();
  const global = esGlobal(sesion);
  const sp = await searchParams;
  const error = uno(sp.error);
  const ok = uno(sp.ok);

  const estudios = await estudiosDe(sesion);
  const sitios = await sitiosDe(estudios.map((e) => e.id));
  const puedeCrear = rolConcede(sesion, 'estudio:create');

  const sitiosPorEstudio = new Map<string, any[]>();
  for (const s of sitios) {
    const lista = sitiosPorEstudio.get(s.estudio_id) ?? [];
    lista.push(s);
    sitiosPorEstudio.set(s.estudio_id, lista);
  }

  return (
    <>
      <PageHeader
        eyebrow="Estructura"
        title="Estudios"
        subtitle={
          global
            ? 'Estructura de los estudios. El número de pacientes es dato clínico y no se muestra al administrador.'
            : 'Los estudios a los que estás asignado, con sus sitios y el avance de captura.'
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

      {estudios.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">∅</div>
            No tienes estudios asignados.
            {!global ? ' Un administrador debe confirmar tu asignación.' : ''}
          </div>
        </div>
      ) : (
        <div className="grid grid-2" style={{ marginBottom: 18 }}>
          {estudios.map((e: any) => {
            const lista = sitiosPorEstudio.get(e.id) ?? [];
            const activos = lista.filter((s) => s.activo).length;
            return (
              <div className="card" key={e.id} id={e.codigo}>
                <div className="card-head">
                  <div>
                    <div className="row" style={{ marginBottom: 3 }}>
                      <span className="mono strong" style={{ fontSize: 17 }}>
                        {e.codigo}
                      </span>
                      <Badge tone={e.estado === 'activo' ? 'ok' : 'neutral'} dot>
                        {e.estado}
                      </Badge>
                    </div>
                    <div className="small muted">{e.nombre}</div>
                  </div>
                  <div className="stat-icon">
                    <Icon name="flask" size={18} />
                  </div>
                </div>
                <div className="card-body">
                  <div
                    className="row"
                    style={{ gap: 22, alignItems: 'flex-start', marginBottom: 16 }}
                  >
                    <div>
                      <div className="k" style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                        Patrocinador
                      </div>
                      <div className="v">{e.patrocinador ?? '—'}</div>
                    </div>
                    <div>
                      <div className="k" style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                        Sitios
                      </div>
                      <div className="v">
                        {activos} activos / {lista.length}
                      </div>
                    </div>
                    <div>
                      <div className="k" style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                        Asignaciones
                      </div>
                      <div className="v">{e.asignaciones}</div>
                    </div>
                    {!global ? (
                      <div>
                        <div className="k" style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                          Pacientes
                        </div>
                        <div className="v">{e.pacientes}</div>
                      </div>
                    ) : null}
                  </div>

                  <table className="data">
                    <thead>
                      <tr>
                        <th>Sitio</th>
                        <th>Nombre</th>
                        {!global ? <th className="num">Pacientes</th> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((s) => (
                        <tr key={s.id}>
                          <td className="strong mono">{s.codigo}</td>
                          <td>{s.nombre}</td>
                          {!global ? <td className="num">{s.pacientes}</td> : null}
                        </tr>
                      ))}
                      {lista.length === 0 ? (
                        <tr>
                          <td colSpan={global ? 2 : 3} className="muted">
                            Sin sitios.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {puedeCrear ? (
        <div className="card">
          <div className="card-head">
            <h3>Crear estudio</h3>
            <span className="hint">
              {global
                ? 'El administrador ve todos los estudios.'
                : 'Quedará pendiente de que un administrador confirme tu asignación.'}
            </span>
          </div>
          <div className="card-body">
            <form action={crearEstudio} className="form">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="codigo">Código *</label>
                  <input
                    id="codigo"
                    name="codigo"
                    type="text"
                    maxLength={20}
                    placeholder="NUEVO"
                    required
                  />
                  <span className="help">Letras, números o guiones. Único.</span>
                </div>
                <div className="field">
                  <label htmlFor="patrocinador">Patrocinador</label>
                  <input id="patrocinador" name="patrocinador" type="text" placeholder="SIM" />
                </div>
                <div className="field span-2">
                  <label htmlFor="nombre">Nombre del estudio *</label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    placeholder="Descripción del estudio"
                    required
                  />
                </div>
              </div>
              <div>
                <button className="btn btn-primary" type="submit">
                  <Icon name="plus" size={16} /> Crear estudio
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
