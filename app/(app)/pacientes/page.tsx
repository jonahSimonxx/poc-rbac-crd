import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { SinAcceso } from '@/components/SinAcceso';
import { requireSesion, rolConcede, decidir } from '@/lib/guard';
import { auditar } from '@/lib/audit';
import { fechaCorta } from '@/lib/format';
import { estudiosDe, pacientesDe, sitiosDe, type FiltroPacientes } from '@/lib/data';

export const dynamic = 'force-dynamic';

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireSesion();

  if (!rolConcede(sesion, 'paciente:read')) {
    await auditar(sesion, 'paciente:read', { tipo: 'paciente', estudioId: null });
    return <SinAcceso mensaje="El rol de administración no accede a datos clínicos." />;
  }

  const sp = await searchParams;
  const filtro: FiltroPacientes = {
    estudio: uno(sp.estudio),
    sitio: uno(sp.sitio),
    q: uno(sp.q),
    estado: uno(sp.estado),
  };

  const estudios = await estudiosDe(sesion);
  const sitios = await sitiosDe(estudios.map((e) => e.id));
  const pacientes = await pacientesDe(sesion, filtro);

  const verIdentidad = decidir(sesion, 'identidad:read', {
    tipo: 'identidad',
    estudioId: estudios[0]?.id ?? null,
  }).permitido;
  const puedeCrear = decidir(sesion, 'paciente:create', {
    tipo: 'paciente',
    estudioId: estudios[0]?.id ?? null,
  }).permitido;

  const error = uno(sp.error);
  const ok = uno(sp.ok);

  return (
    <>
      <PageHeader
        eyebrow="Datos clínicos"
        title="Pacientes"
        subtitle="Pacientes de los estudios a los que estás asignado. La identidad se guarda separada del cuaderno de recogida de datos."
        actions={
          puedeCrear ? (
            <Link href="/pacientes/nuevo" className="btn btn-primary">
              <Icon name="plus" size={16} /> Nuevo paciente
            </Link>
          ) : null
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

      <form method="get" className="card pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, minWidth: 200 }}>
            <label htmlFor="q">Buscar</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filtro.q ?? ''}
              placeholder="Código, iniciales o nombre"
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 150 }}>
            <label htmlFor="estudio">Estudio</label>
            <select id="estudio" name="estudio" defaultValue={filtro.estudio ?? ''}>
              <option value="">Todos</option>
              {estudios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.codigo}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 170 }}>
            <label htmlFor="sitio">Sitio</label>
            <select id="sitio" name="sitio" defaultValue={filtro.sitio ?? ''}>
              <option value="">Todos</option>
              {sitios.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.estudio} · {s.codigo}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" defaultValue={filtro.estado ?? ''}>
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="anulado">Anulados</option>
            </select>
          </div>
          <button className="btn btn-ghost" type="submit">
            <Icon name="search" size={16} /> Filtrar
          </button>
          <Link href="/pacientes" className="btn-link">
            Limpiar
          </Link>
        </div>
      </form>

      <div className="card">
        <div className="card-head">
          <h3>Listado</h3>
          <span className="hint">{pacientes.length} pacientes</span>
        </div>

        {pacientes.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">∅</div>
            No hay pacientes que coincidan con el filtro.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Código</th>
                  {verIdentidad ? <th>Paciente</th> : null}
                  <th>Edad / Sexo</th>
                  <th>Estudio</th>
                  <th>Sitio</th>
                  <th>CRD</th>
                  <th className="num">Eventos</th>
                  <th>Estado</th>
                  <th>Alta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pacientes.map((p: any) => (
                  <tr key={p.id}>
                    <td className="strong mono">{p.codigo}</td>
                    {verIdentidad ? (
                      <td>
                        {p.nombre ?? p.iniciales}
                        <div className="muted tiny">Iniciales {p.iniciales}</div>
                      </td>
                    ) : null}
                    <td>
                      {p.edad} años · {p.sexo}
                    </td>
                    <td>
                      <Badge tone="brand">{p.estudio}</Badge>
                    </td>
                    <td>{p.sitio}</td>
                    <td>
                      <span className="small">
                        {p.crd_firmados}/{p.crd_total} firmados
                      </span>
                    </td>
                    <td className="num">{p.eventos}</td>
                    <td>
                      {p.anulado ? (
                        <Badge tone="danger" dot>
                          Anulado
                        </Badge>
                      ) : (
                        <Badge tone="ok" dot>
                          Activo
                        </Badge>
                      )}
                    </td>
                    <td className="muted nowrap">{fechaCorta(p.creado_en)}</td>
                    <td>
                      <Link href={`/pacientes/${p.id}`} className="btn-link">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
