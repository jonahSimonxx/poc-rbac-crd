import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { SinAcceso } from '@/components/SinAcceso';
import { requireSesion, decidir } from '@/lib/guard';
import { auditar } from '@/lib/audit';
import { auditoriaDePaciente, pacienteDetalle } from '@/lib/data';
import { ETIQUETA_CRD, fecha, fechaCorta, hashCorto, inicialesDe } from '@/lib/format';
import {
  anularCrd,
  anularPaciente,
  crearCrd,
  crearDosis,
  crearEvento,
  firmarCrd,
} from '../actions';

export const dynamic = 'force-dynamic';

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function tonoEstado(estado: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (estado === 'firmado') return 'ok';
  if (estado === 'borrador') return 'warn';
  if (estado === 'anulado') return 'danger';
  return 'neutral';
}

function tonoGravedad(g: string): 'ok' | 'warn' | 'danger' {
  if (g === 'grave') return 'danger';
  if (g === 'moderada') return 'warn';
  return 'ok';
}

export default async function PacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireSesion();
  const { id } = await params;

  const detalle = await pacienteDetalle(id);
  if (!detalle) notFound();

  const p = detalle.paciente;
  const estudioId: string = p.estudio_id;

  const lectura = decidir(sesion, 'paciente:read', { tipo: 'paciente', id, estudioId });
  if (!lectura.permitido) {
    await auditar(
      sesion,
      'paciente:read',
      { tipo: 'paciente', id, estudioId },
      { paciente: p.codigo },
      lectura,
    );
    return (
      <SinAcceso mensaje="Este paciente pertenece a un estudio al que no estás asignado, o tu rol no accede a datos clínicos." />
    );
  }

  const sp = await searchParams;
  const error = uno(sp.error);
  const ok = uno(sp.ok);

  const verIdentidad = decidir(sesion, 'identidad:read', {
    tipo: 'identidad',
    id,
    estudioId,
  }).permitido;
  const puedeCrearCrd = decidir(sesion, 'crd:create', { tipo: 'crd', estudioId }).permitido;
  const puedeFirmar = decidir(sesion, 'crd:sign', { tipo: 'crd', estudioId }).permitido;
  const puedeAnularCrd = decidir(sesion, 'crd:annul', { tipo: 'crd', estudioId }).permitido;
  const puedeAnularPaciente = decidir(sesion, 'paciente:annul', {
    tipo: 'paciente',
    id,
    estudioId,
  }).permitido;
  const puedeEvento = decidir(sesion, 'evento:create', { tipo: 'evento', estudioId }).permitido;
  const puedeDosis = decidir(sesion, 'dosis:create', { tipo: 'dosis', estudioId }).permitido;
  const verAuditoria = decidir(sesion, 'auditoria_clinica:read', {
    tipo: 'auditoria_clinica',
    estudioId,
  }).permitido;

  const auditoria = verAuditoria ? await auditoriaDePaciente(id, 30) : [];

  const siguienteToma =
    detalle.dosis.length > 0
      ? Math.max(...detalle.dosis.map((d: any) => d.numero_toma)) + 1
      : 1;

  return (
    <>
      <div className="detail-hero">
        <div className="big-avatar">
          {verIdentidad && detalle.identidad
            ? inicialesDe(detalle.identidad.nombre)
            : p.iniciales}
        </div>
        <div>
          <div className="row" style={{ marginBottom: 4 }}>
            <span className="eyebrow" style={{ marginBottom: 0 }}>
              Paciente
            </span>
            <Badge tone="brand">{p.estudio}</Badge>
            {p.anulado ? (
              <Badge tone="danger" dot>
                Anulado
              </Badge>
            ) : (
              <Badge tone="ok" dot>
                Activo
              </Badge>
            )}
          </div>
          <h1 className="mono">{p.codigo}</h1>
          <div className="meta">
            {verIdentidad && detalle.identidad ? `${detalle.identidad.nombre} · ` : ''}
            {p.edad} años · {p.sexo === 'M' ? 'Masculino' : 'Femenino'} · {p.sitio_nombre} (
            {p.sitio})
          </div>
        </div>
        <div className="actions">
          {puedeCrearCrd && !p.anulado ? (
            <a href="#nuevo-crd" className="btn btn-primary">
              <Icon name="plus" size={16} /> Nuevo CRD
            </a>
          ) : null}
          <Link href="/pacientes" className="btn btn-ghost">
            Volver
          </Link>
        </div>
      </div>

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

      {p.anulado ? (
        <div className="notice notice-warn">
          <Icon name="ban" size={16} />
          <span>
            <strong>Paciente anulado.</strong> Motivo: {p.motivo_anulacion ?? '—'}. El registro se
            conserva; no existe borrado clínico.
          </span>
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Datos clínicos</h3>
            <span className="hint">Sin identidad personal</span>
          </div>
          <div className="card-body">
            <div className="kv">
              <div>
                <div className="k">Estudio</div>
                <div className="v">
                  {p.estudio} · {p.estudio_nombre}
                </div>
              </div>
              <div>
                <div className="k">Sitio</div>
                <div className="v">
                  {p.sitio} · {p.sitio_nombre}
                </div>
              </div>
              <div>
                <div className="k">Peso</div>
                <div className="v">{p.peso_kg ? `${p.peso_kg} kg` : '—'}</div>
              </div>
              <div>
                <div className="k">Color de piel</div>
                <div className="v">{p.color_piel ?? '—'}</div>
              </div>
              <div>
                <div className="k">Diagnóstico</div>
                <div className="v">{p.diagnostico ?? '—'}</div>
              </div>
              <div>
                <div className="k">Alta</div>
                <div className="v">{fechaCorta(p.creado_en)}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="k">Antecedentes</div>
                <div className="v">{p.antecedentes ?? '—'}</div>
              </div>
            </div>
          </div>
        </div>

        {verIdentidad && detalle.identidad ? (
          <div className="card identity">
            <div className="card-head">
              <h3>Identidad del paciente</h3>
              <span className="seal">
                <Icon name="lock" size={13} /> Tabla separada
              </span>
            </div>
            <div className="card-body">
              <div className="kv">
                <div>
                  <div className="k">Nombre</div>
                  <div className="v">{detalle.identidad.nombre}</div>
                </div>
                <div>
                  <div className="k">Documento</div>
                  <div className="v mono">{detalle.identidad.documento}</div>
                </div>
                <div>
                  <div className="k">Teléfono</div>
                  <div className="v">{detalle.identidad.telefono ?? '—'}</div>
                </div>
                <div>
                  <div className="k">Consentimiento</div>
                  <div className="v">
                    {detalle.identidad.consentimiento_firmado ? (
                      <Badge tone="ok">Firmado</Badge>
                    ) : (
                      <Badge tone="warn">Pendiente</Badge>
                    )}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="k">Fecha de consentimiento</div>
                  <div className="v">{fechaCorta(detalle.identidad.consentimiento_fecha)}</div>
                </div>
              </div>
              <p className="small muted" style={{ marginTop: 16, marginBottom: 0 }}>
                La identidad vive fuera del CRD. El cuaderno solo conoce el código del paciente.
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-head">
              <h3>Identidad del paciente</h3>
              <Badge tone="danger">
                <Icon name="lock" size={13} /> Restringida
              </Badge>
            </div>
            <div className="card-body">
              <p className="muted small">
                Tu rol no puede ver los datos personales de este paciente.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="stack">
        {/* ---------------- CRD ---------------- */}
        <div className="card">
          <div className="card-head">
            <h3>Cuaderno de recogida de datos</h3>
            <span className="hint">{detalle.crds.length} formularios</span>
          </div>

          {detalle.crds.length === 0 ? (
            <div className="empty">Sin formularios. Crea el primero.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Formulario</th>
                    <th>Visita</th>
                    <th>Estado</th>
                    <th>Firmado por</th>
                    <th>Fecha de firma</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.crds.map((c: any) => (
                    <tr key={c.id}>
                      <td className="strong">{ETIQUETA_CRD[c.tipo] ?? c.tipo}</td>
                      <td className="num">{c.visita}</td>
                      <td>
                        <Badge tone={tonoEstado(c.estado)}>{c.estado}</Badge>
                      </td>
                      <td className="muted">{c.firmado_por_nombre ?? '—'}</td>
                      <td className="muted">{fecha(c.firmado_en)}</td>
                      <td>
                        {c.estado === 'borrador' && puedeFirmar ? (
                          <form action={firmarCrd}>
                            <input type="hidden" name="crdId" value={c.id} />
                            <button className="btn btn-sm btn-primary" type="submit">
                              <Icon name="pen" size={13} /> Firmar
                            </button>
                          </form>
                        ) : null}
                        {c.estado !== 'anulado' && puedeAnularCrd ? (
                          <details className="reveal" style={{ borderTop: 'none' }}>
                            <summary>Anular</summary>
                            <div className="reveal-body">
                              <form action={anularCrd} className="form">
                                <input type="hidden" name="crdId" value={c.id} />
                                <div className="field">
                                  <label>Motivo de anulación *</label>
                                  <textarea name="motivo" required />
                                </div>
                                <button className="btn btn-danger btn-sm" type="submit">
                                  Confirmar anulación
                                </button>
                              </form>
                            </div>
                          </details>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {puedeCrearCrd && !p.anulado ? (
            <details className="reveal" id="nuevo-crd">
              <summary>Nuevo formulario</summary>
              <div className="reveal-body">
                <form action={crearCrd} className="form">
                  <input type="hidden" name="pacienteId" value={id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="tipo">Tipo de formulario *</label>
                      <select id="tipo" name="tipo" required defaultValue="evaluacion_intermedia">
                        {Object.entries(ETIQUETA_CRD).map(([valor, etiqueta]) => (
                          <option key={valor} value={valor}>
                            {etiqueta}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="visita">Visita *</label>
                      <input id="visita" name="visita" type="number" min={1} defaultValue={1} required />
                    </div>
                  </div>
                  <div>
                    <button className="btn btn-primary btn-sm" type="submit">
                      <Icon name="plus" size={14} /> Crear en borrador
                    </button>
                  </div>
                </form>
              </div>
            </details>
          ) : null}
        </div>

        {/* ---------------- Dosis ---------------- */}
        <div className="card">
          <div className="card-head">
            <h3>Administración de medicamento</h3>
            <span className="hint">{detalle.dosis.length} tomas</span>
          </div>

          {detalle.dosis.length === 0 ? (
            <div className="empty">Sin tomas registradas.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="num">Toma</th>
                    <th>Lote</th>
                    <th className="num">Dosis</th>
                    <th>Vía</th>
                    <th>Fecha y hora</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.dosis.map((d: any) => (
                    <tr key={d.id}>
                      <td className="num strong">{d.numero_toma}</td>
                      <td className="mono">{d.lote ?? '—'}</td>
                      <td className="num">{d.dosis_mg} mg</td>
                      <td>
                        <Badge tone="neutral">{d.via}</Badge>
                      </td>
                      <td className="muted">{fecha(d.fecha_hora)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {puedeDosis && !p.anulado ? (
            <details className="reveal">
              <summary>Registrar toma</summary>
              <div className="reveal-body">
                <form action={crearDosis} className="form">
                  <input type="hidden" name="pacienteId" value={id} />
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="numeroToma">Número de toma *</label>
                      <input
                        id="numeroToma"
                        name="numeroToma"
                        type="number"
                        min={1}
                        defaultValue={siguienteToma}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="dosisMg">Dosis (mg) *</label>
                      <input id="dosisMg" name="dosisMg" type="number" step="0.01" min="0.01" required />
                    </div>
                    <div className="field">
                      <label htmlFor="via">Vía *</label>
                      <input id="via" name="via" type="text" placeholder="SC / IV" required />
                    </div>
                    <div className="field">
                      <label htmlFor="lote">Lote</label>
                      <input id="lote" name="lote" type="text" placeholder="ES 250003" />
                    </div>
                    <div className="field span-2">
                      <label htmlFor="fechaHora">Fecha y hora</label>
                      <input id="fechaHora" name="fechaHora" type="datetime-local" />
                    </div>
                  </div>
                  <div>
                    <button className="btn btn-primary btn-sm" type="submit">
                      Registrar
                    </button>
                  </div>
                </form>
              </div>
            </details>
          ) : null}
        </div>

        {/* ---------------- Eventos ---------------- */}
        <div className="card">
          <div className="card-head">
            <h3>Eventos adversos</h3>
            <span className="hint">{detalle.eventos.length} registrados</span>
          </div>

          {detalle.eventos.length === 0 ? (
            <div className="empty">Sin eventos adversos.</div>
          ) : (
            <div className="list">
              {detalle.eventos.map((ev: any) => (
                <div className="list-item" key={ev.id}>
                  <span className="li-icon">
                    <Icon name="alert" size={16} />
                  </span>
                  <div className="li-body">
                    <div className="li-title">
                      {ev.descripcion}{' '}
                      <Badge tone={tonoGravedad(ev.gravedad)}>{ev.gravedad}</Badge>
                    </div>
                    <div className="li-sub">
                      Causalidad: {ev.causalidad?.replace('_', ' ') ?? '—'} · Desenlace:{' '}
                      {ev.desenlace ?? '—'}
                    </div>
                    <div className="li-sub">
                      {fechaCorta(ev.fecha_inicio)} → {fechaCorta(ev.fecha_fin)} · registrado por{' '}
                      {ev.creado_por_nombre ?? '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {puedeEvento && !p.anulado ? (
            <details className="reveal">
              <summary>Documentar evento adverso</summary>
              <div className="reveal-body">
                <form action={crearEvento} className="form">
                  <input type="hidden" name="pacienteId" value={id} />
                  <div className="field">
                    <label htmlFor="descripcion">Descripción *</label>
                    <input
                      id="descripcion"
                      name="descripcion"
                      type="text"
                      placeholder="Hemorragia digestiva"
                      required
                    />
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="gravedad">Gravedad *</label>
                      <select id="gravedad" name="gravedad" required defaultValue="leve">
                        <option value="leve">Leve</option>
                        <option value="moderada">Moderada</option>
                        <option value="grave">Grave</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="causalidad">Causalidad</label>
                      <select id="causalidad" name="causalidad" defaultValue="">
                        <option value="">Sin evaluar</option>
                        <option value="no_relacionada">No relacionada</option>
                        <option value="posible">Posible</option>
                        <option value="probable">Probable</option>
                        <option value="definitiva">Definitiva</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="fechaInicio">Fecha de inicio</label>
                      <input id="fechaInicio" name="fechaInicio" type="date" />
                    </div>
                    <div className="field">
                      <label htmlFor="fechaFin">Fecha de fin</label>
                      <input id="fechaFin" name="fechaFin" type="date" />
                    </div>
                    <div className="field span-2">
                      <label htmlFor="desenlace">Desenlace</label>
                      <input id="desenlace" name="desenlace" type="text" placeholder="Recuperado" />
                    </div>
                  </div>
                  <div>
                    <button className="btn btn-primary btn-sm" type="submit">
                      Registrar evento
                    </button>
                  </div>
                </form>
              </div>
            </details>
          ) : null}
        </div>

        {/* ---------------- Auditoría del paciente ---------------- */}
        {verAuditoria ? (
          <div className="card">
            <div className="card-head">
              <h3>Auditoría de este paciente</h3>
              <span className="hint">{auditoria.length} registros</span>
            </div>
            {auditoria.length === 0 ? (
              <div className="empty">Sin registros de auditoría.</div>
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
                      <th>Resultado</th>
                      <th>Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditoria.map((a: any) => (
                      <tr key={a.id}>
                        <td className="num mono">{a.id}</td>
                        <td className="muted nowrap">{fecha(a.fecha)}</td>
                        <td>{a.usuario_nombre ?? 'Sistema'}</td>
                        <td>
                          {a.entidad} <span className="muted">#{a.entidad_id}</span>
                        </td>
                        <td>{a.accion}</td>
                        <td>
                          <Badge tone={a.resultado === 'permitido' ? 'ok' : 'danger'}>
                            {a.resultado}
                          </Badge>
                        </td>
                        <td className="mono tiny">{hashCorto(a.hash)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {/* ---------------- Zona sensible ---------------- */}
        {puedeAnularPaciente && !p.anulado ? (
          <div className="card">
            <div className="card-head">
              <h3>Zona sensible</h3>
              <span className="hint">Sin borrado clínico</span>
            </div>
            <div className="card-body">
              <p className="small muted" style={{ marginTop: 0 }}>
                Anular conserva el registro y lo marca como inválido. La operación exige un motivo y
                queda auditada.
              </p>
              <details className="reveal" style={{ borderTop: 'none' }}>
                <summary>Anular paciente</summary>
                <div className="reveal-body">
                  <form action={anularPaciente} className="form">
                    <input type="hidden" name="pacienteId" value={id} />
                    <div className="field">
                      <label htmlFor="motivoAnulacion">Motivo de anulación *</label>
                      <textarea id="motivoAnulacion" name="motivo" required />
                    </div>
                    <div>
                      <button className="btn btn-danger" type="submit">
                        <Icon name="ban" size={15} /> Confirmar anulación
                      </button>
                    </div>
                  </form>
                </div>
              </details>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
