import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { SinAcceso } from '@/components/SinAcceso';
import { VerificarBoton } from '@/components/VerificarBoton';
import { requireSesion, esGlobal, rolConcede } from '@/lib/guard';
import { auditoriaDe, estudiosDe, resumenAuditoria, verificarCadena } from '@/lib/data';
import type { FiltroAuditoria } from '@/lib/data';
import { ETIQUETA_ENTIDAD, fecha, hashCorto } from '@/lib/format';

export const dynamic = 'force-dynamic';

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function detalleLegible(detalle: unknown): string {
  if (detalle === null || detalle === undefined) return '—';
  if (typeof detalle !== 'object') return String(detalle);
  const partes = Object.entries(detalle as Record<string, unknown>).map(([k, v]) => {
    if (v === null || v === undefined) return `${k}: —`;
    if (typeof v === 'object') return `${k}: ${JSON.stringify(v)}`;
    return `${k}: ${String(v)}`;
  });
  return partes.length === 0 ? '—' : partes.join(' · ');
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireSesion();

  const admin = rolConcede(sesion, 'auditoria_admin:read');
  const clinica = rolConcede(sesion, 'auditoria_clinica:read');

  if (!admin && !clinica) {
    return <SinAcceso mensaje="Tu rol no tiene acceso a la pista de auditoría." />;
  }

  const global = esGlobal(sesion);
  const sp = await searchParams;

  const filtro: FiltroAuditoria = {
    entidad: uno(sp.entidad),
    resultado: uno(sp.resultado),
    estudio: uno(sp.estudio),
    q: uno(sp.q),
  };

  const [registros, resumen, cadena, estudios] = await Promise.all([
    auditoriaDe(sesion, 150, filtro),
    resumenAuditoria(sesion),
    verificarCadena(),
    estudiosDe(sesion),
  ]);

  const entidades = global
    ? ['usuario', 'asignacion', 'sesion', 'estudio', 'auditoria']
    : ['paciente', 'identidad', 'crd', 'dosis', 'evento', 'asignacion', 'estudio'];

  const verificacionInicial = {
    total: cadena.total,
    integra: cadena.integra,
    primerError: cadena.primerError,
    fecha: new Date().toISOString(),
  };

  return (
    <>
      <PageHeader
        eyebrow="Trazabilidad"
        title="Auditoría"
        subtitle={
          global
            ? 'Auditoría administrativa: cuentas, asignaciones, sesiones y estructura. La aplicación no puede ver ni modificar la auditoría clínica.'
            : 'Auditoría de tus estudios: accesos, decisiones y cambios clínicos. Cada entrada se encadena por hash y es inmutable.'
        }
        actions={
          <Badge tone={global ? 'neutral' : 'brand'} dot>
            {global ? 'Ámbito administrativo' : `Ámbito clínico · ${sesion.estudios.map((e) => e.codigo).join(' · ')}`}
          </Badge>
        }
      />

      <div className="grid grid-3" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-top">
            <span className="stat-label">Registros visibles</span>
            <span className="stat-icon">
              <Icon name="clipboard" size={18} />
            </span>
          </div>
          <div className="stat-value">{resumen.total}</div>
          <div className="stat-hint">{global ? 'Administrativos' : 'De tus estudios'}</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span className="stat-label">Accesos denegados</span>
            <span className="stat-icon tone-danger">
              <Icon name="ban" size={18} />
            </span>
          </div>
          <div className="stat-value">{resumen.denegados}</div>
          <div className="stat-hint">Intentos rechazados por el motor</div>
        </div>
        <div className="stat">
          <div className="stat-top">
            <span className="stat-label">Último movimiento</span>
            <span className="stat-icon tone-info">
              <Icon name="activity" size={18} />
            </span>
          </div>
          <div className="stat-value" style={{ fontSize: 17, marginTop: 12 }}>
            {fecha(resumen.ultimo)}
          </div>
          <div className="stat-hint">Hora del servidor</div>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <VerificarBoton inicial={verificacionInicial} />
      </div>

      <form method="get" className="card pad" style={{ marginBottom: 18 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 2, minWidth: 200 }}>
            <label htmlFor="q">Buscar</label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filtro.q ?? ''}
              placeholder="Identificador, acción o usuario"
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="entidad">Entidad</label>
            <select id="entidad" name="entidad" defaultValue={filtro.entidad ?? ''}>
              <option value="">Todas</option>
              {entidades.map((e) => (
                <option key={e} value={e}>
                  {ETIQUETA_ENTIDAD[e] ?? e}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="resultado">Resultado</label>
            <select id="resultado" name="resultado" defaultValue={filtro.resultado ?? ''}>
              <option value="">Todos</option>
              <option value="permitido">Permitido</option>
              <option value="denegado">Denegado</option>
            </select>
          </div>
          {!global ? (
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
          ) : null}
          <button className="btn btn-ghost" type="submit">
            <Icon name="search" size={16} /> Filtrar
          </button>
          <Link href="/auditoria" className="btn-link">
            Limpiar
          </Link>
        </div>
      </form>

      <div className="card">
        <div className="card-head">
          <h3>Pista de auditoría</h3>
          <span className="hint">{registros.length} entradas · orden descendente</span>
        </div>

        {registros.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">∅</div>
            No hay registros que coincidan con el filtro.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Entidad</th>
                  <th>Acción</th>
                  <th>Estudio</th>
                  <th>Resultado</th>
                  <th>Detalle</th>
                  <th>Hash</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((a: any) => (
                  <tr key={a.id}>
                    <td className="num mono strong">{a.id}</td>
                    <td className="muted nowrap">{fecha(a.fecha)}</td>
                    <td>
                      {a.usuario_nombre ?? <span className="muted">Sistema</span>}
                      {a.rol_codigo ? (
                        <div className="muted tiny">{a.rol_codigo}</div>
                      ) : null}
                    </td>
                    <td>
                      {ETIQUETA_ENTIDAD[a.entidad] ?? a.entidad}
                      <div className="muted tiny mono">#{a.entidad_id}</div>
                    </td>
                    <td>
                      <span className="mono small">{a.accion}</span>
                    </td>
                    <td>
                      {a.estudio_codigo ? (
                        <Badge tone="brand">{a.estudio_codigo}</Badge>
                      ) : (
                        <span className="muted tiny">—</span>
                      )}
                    </td>
                    <td>
                      {a.resultado === 'permitido' ? (
                        <Badge tone="ok" dot>
                          Permitido
                        </Badge>
                      ) : (
                        <Badge tone="danger" dot>
                          Denegado
                        </Badge>
                      )}
                    </td>
                    <td className="muted small" style={{ maxWidth: 280 }}>
                      {detalleLegible(a.detalle)}
                    </td>
                    <td className="mono tiny" title={a.hash ?? ''}>
                      {hashCorto(a.hash)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="notice notice-info" style={{ marginTop: 18 }}>
        <Icon name="lock" size={16} />
        <span>
          {global
            ? 'La auditoría administrativa no incluye datos clínicos. El administrador no puede leer la pista clínica de los estudios.'
            : 'La auditoría clínica de tus estudios incluye accesos permitidos y denegados. El administrador del sistema no tiene acceso a esta vista.'}
        </span>
      </div>
    </>
  );
}
