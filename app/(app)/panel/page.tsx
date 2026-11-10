import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';
import { Stat } from '@/components/Stat';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { requireSesion, esGlobal, rolesDe } from '@/lib/guard';
import type { Sesion } from '@/lib/auth';
import { ETIQUETA_ROL, ETIQUETA_CRD, fecha } from '@/lib/format';
import {
  avancePorEstudio,
  auditoriaDe,
  crdPendientes,
  estudiosDe,
  eventosRecientes,
  resumenAdmin,
  resumenClinico,
  verificarCadena,
} from '@/lib/data';

export const dynamic = 'force-dynamic';

function tonoGravedad(g: string): 'ok' | 'warn' | 'danger' {
  if (g === 'grave') return 'danger';
  if (g === 'moderada') return 'warn';
  return 'ok';
}

export default async function PanelPage() {
  const sesion = await requireSesion();
  const global = esGlobal(sesion);
  const roles = rolesDe(sesion);
  const nombre = sesion.usuario.nombre.split(/\s+/)[0];
  const rolPrincipal = roles.length > 0 ? ETIQUETA_ROL[roles[0]] : 'Sin rol';

  return (
    <>
      <PageHeader
        eyebrow="Panel"
        title={`Hola, ${nombre}`}
        subtitle={
          global
            ? 'Administración del sistema: cuentas, asignaciones y auditoría administrativa. Sin acceso a datos clínicos.'
            : `Vista de ${rolPrincipal.toLowerCase()} · ${sesion.estudios.map((e) => e.codigo).join(' · ')}`
        }
        actions={
          <>
            {roles.includes('medico-investigador') ? (
              <Link href="/pacientes/nuevo" className="btn btn-primary">
                <Icon name="plus" size={16} /> Nuevo paciente
              </Link>
            ) : null}
            <Link href="/auditoria" className="btn btn-ghost">
              <Icon name="clipboard" size={16} /> Auditoría
            </Link>
          </>
        }
      />

      {global ? <PanelAdmin sesion={sesion} /> : <PanelClinico sesion={sesion} />}
    </>
  );
}

async function PanelAdmin({ sesion }: { sesion: Sesion }) {
  const [resumen, estudios, cadena, actividad] = await Promise.all([
    resumenAdmin(),
    estudiosDe(sesion),
    verificarCadena(),
    auditoriaDe(sesion, 8),
  ]);

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat label="Usuarios activos" value={resumen.usuarios} hint="Cuentas habilitadas" icon="users" />
        <Stat label="Estudios" value={resumen.estudios} hint="En el sistema" icon="flask" tone="info" />
        <Stat
          label="Asignaciones activas"
          value={resumen.asignaciones}
          hint="Usuario + estudio + rol"
          icon="link"
          tone="info"
        />
        <Stat
          label="Eventos de auditoría"
          value={resumen.auditoria}
          hint="Pista global encadenada"
          icon="clipboard"
        />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Integridad de la auditoría</h3>
            <Badge tone={cadena.integra ? 'ok' : 'danger'} dot>
              {cadena.integra ? 'Cadena íntegra' : 'Cadena alterada'}
            </Badge>
          </div>
          <div className="card-body">
            <div className={`chain${cadena.integra ? '' : ' broken'}`}>
              <span className="chain-icon">
                <Icon name={cadena.integra ? 'shield' : 'alert'} size={22} />
              </span>
              <div>
                <div className="chain-title">{cadena.total} registros encadenados</div>
                <div className="chain-sub">
                  {cadena.integra
                    ? 'Cada hash enlaza con el anterior mediante SHA-256.'
                    : `Primer registro inconsistente: #${cadena.primerError}`}
                </div>
              </div>
            </div>
            <p className="small muted" style={{ margin: '14px 0 0' }}>
              La aplicación no puede modificar la auditoría: el rol de base solo tiene INSERT y
              SELECT sobre la tabla.
            </p>
            <Link href="/auditoria" className="btn btn-ghost btn-sm" style={{ marginTop: 14 }}>
              Ver auditoría administrativa
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Actividad administrativa reciente</h3>
            <span className="hint">últimos movimientos</span>
          </div>
          <div className="list">
            {actividad.length === 0 ? (
              <div className="empty">Sin registros.</div>
            ) : (
              actividad.map((a: any) => (
                <div className="list-item" key={a.id}>
                  <span className="li-icon">
                    <Icon name="activity" size={16} />
                  </span>
                  <div className="li-body">
                    <div className="li-title">
                      {a.accion} · {a.entidad} <span className="muted">#{a.entidad_id}</span>
                    </div>
                    <div className="li-sub">
                      {a.usuario_nombre ?? 'Sistema'} · {fecha(a.fecha)}
                    </div>
                  </div>
                  <div className="li-side">
                    <Badge tone={a.resultado === 'permitido' ? 'ok' : 'danger'}>{a.resultado}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Estudios</h3>
          <span className="hint">{estudios.length} en el sistema</span>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Código</th>
                <th>Estudio</th>
                <th>Estado</th>
                <th className="num">Sitios</th>
                <th className="num">Asignaciones</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {estudios.map((e: any) => (
                <tr key={e.id}>
                  <td className="strong">{e.codigo}</td>
                  <td>{e.nombre}</td>
                  <td>
                    <Badge tone={e.estado === 'activo' ? 'ok' : 'neutral'}>{e.estado}</Badge>
                  </td>
                  <td className="num">{e.sitios}</td>
                  <td className="num">{e.asignaciones}</td>
                  <td>
                    <Link href="/estudios" className="btn-link">
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="notice notice-info">
        <Icon name="lock" size={16} />
        <span>
          Como administrador no ves pacientes, CRD ni eventos adversos. Solo gestionas cuentas,
          estructura y auditoría administrativa.
        </span>
      </div>
    </div>
  );
}

async function PanelClinico({ sesion }: { sesion: Sesion }) {
  const [resumen, avance, eventos, pendientes] = await Promise.all([
    resumenClinico(sesion),
    avancePorEstudio(sesion),
    eventosRecientes(sesion, 5),
    crdPendientes(sesion, 5),
  ]);

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat
          label="Pacientes activos"
          value={resumen.pacientes}
          hint={`${resumen.anulados} anulados`}
          icon="users"
        />
        <Stat
          label="CRD firmados"
          value={resumen.crd_firmados}
          hint={`${resumen.crd_borrador} en borrador`}
          icon="check"
          tone="info"
        />
        <Stat
          label="Eventos adversos"
          value={resumen.eventos}
          hint="Registrados en el estudio"
          icon="alert"
          tone="warn"
        />
        <Stat
          label="Tomas registradas"
          value={resumen.dosis}
          hint="Administraciones de medicamento"
          icon="pill"
        />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Avance por estudio</h3>
            <span className="hint">CRD firmados sobre el total</span>
          </div>
          <div className="card-body stack" style={{ gap: 18 }}>
            {avance.length === 0 ? (
              <div className="empty">Sin estudios asignados.</div>
            ) : (
              avance.map((e: any) => {
                const total = e.firmados + e.borradores;
                const pct = total === 0 ? 0 : Math.round((e.firmados / total) * 100);
                return (
                  <div key={e.codigo}>
                    <div
                      className="row"
                      style={{ justifyContent: 'space-between', marginBottom: 6 }}
                    >
                      <div>
                        <strong>{e.codigo}</strong>{' '}
                        <span className="muted small">
                          · {e.pacientes} pacientes · {e.sitios} sitios
                        </span>
                      </div>
                      <span className="small muted">
                        {e.firmados}/{total} · {pct}%
                      </span>
                    </div>
                    <div className={`progress${pct < 50 ? ' warn' : ''}`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Eventos adversos recientes</h3>
            <span className="hint">últimos 5</span>
          </div>
          <div className="list">
            {eventos.length === 0 ? (
              <div className="empty">Sin eventos registrados.</div>
            ) : (
              eventos.map((ev: any) => (
                <div className="list-item" key={ev.id}>
                  <span className="li-icon">
                    <Icon name="alert" size={16} />
                  </span>
                  <div className="li-body">
                    <div className="li-title">{ev.descripcion}</div>
                    <div className="li-sub">
                      <Link href={`/pacientes/${ev.paciente_id}`}>{ev.paciente}</Link> · {ev.estudio}{' '}
                      · {ev.causalidad?.replace('_', ' ') ?? 'sin causalidad'}
                    </div>
                  </div>
                  <div className="li-side">
                    <Badge tone={tonoGravedad(ev.gravedad)}>{ev.gravedad}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Pendientes de firma</h3>
          <span className="hint">{pendientes.length} CRD en borrador</span>
        </div>
        {pendientes.length === 0 ? (
          <div className="empty">No hay formularios pendientes.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Estudio</th>
                  <th>Formulario</th>
                  <th className="num">Visita</th>
                  <th>Creado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((c: any) => (
                  <tr key={c.id}>
                    <td className="strong">{c.paciente}</td>
                    <td>
                      <Badge tone="brand">{c.estudio}</Badge>
                    </td>
                    <td>{ETIQUETA_CRD[c.tipo] ?? c.tipo}</td>
                    <td className="num">{c.visita}</td>
                    <td className="muted">{fecha(c.creado_en)}</td>
                    <td>
                      <Link href={`/pacientes/${c.paciente_id}`} className="btn-link">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rolesDe(sesion).includes('jefe-estudio') ? (
        <div className="notice notice-info">
          <Icon name="clipboard" size={16} />
          <span>
            Como jefe de estudio puedes supervisar y leer la auditoría clínica de tus estudios,
            pero no crear, editar ni firmar datos clínicos.
          </span>
        </div>
      ) : null}
    </div>
  );
}
