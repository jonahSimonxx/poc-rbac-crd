import Link from 'next/link';

import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/Badge';
import { Icon } from '@/components/Icon';
import { SinAcceso } from '@/components/SinAcceso';
import { requireSesion, decidir } from '@/lib/guard';
import { auditar } from '@/lib/audit';
import { estudiosParaFormulario } from '@/lib/data';
import { crearPaciente } from '../actions';

export const dynamic = 'force-dynamic';

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function NuevoPacientePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sesion = await requireSesion();
  const estudios = await estudiosParaFormulario(sesion);

  const primera = estudios[0]?.id ?? null;
  const puedeCrear = decidir(sesion, 'paciente:create', {
    tipo: 'paciente',
    estudioId: primera,
  }).permitido;

  if (!puedeCrear) {
    await auditar(sesion, 'paciente:create', { tipo: 'paciente', estudioId: primera });
    return (
      <SinAcceso mensaje="Solo el médico investigador puede dar de alta pacientes en su estudio." />
    );
  }

  const sp = await searchParams;
  const error = uno(sp.error);

  return (
    <>
      <PageHeader
        eyebrow="Datos clínicos"
        title="Nuevo paciente"
        subtitle="Los datos de identidad se guardan en una tabla separada del cuaderno de recogida de datos."
        actions={
          <Link href="/pacientes" className="btn btn-ghost">
            Cancelar
          </Link>
        }
      />

      {error ? (
        <div className="notice notice-error">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      <form action={crearPaciente} className="stack">
        <div className="card">
          <div className="card-head">
            <h3>Datos clínicos</h3>
            <span className="hint">Sin identidad personal</span>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="estudioId">Estudio *</label>
                <select id="estudioId" name="estudioId" required defaultValue={primera ?? ''}>
                  {estudios.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.codigo} · {e.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="sitioId">Sitio *</label>
                <select id="sitioId" name="sitioId" required>
                  {estudios.map((e: any) =>
                    (e.sitios as any[]).map((s) => (
                      <option key={s.id} value={s.id}>
                        {e.codigo} · {s.codigo} · {s.nombre}
                      </option>
                    )),
                  )}
                </select>
              </div>

              <div className="field">
                <label htmlFor="codigo">Código de paciente *</label>
                <input
                  id="codigo"
                  name="codigo"
                  type="text"
                  placeholder="HSA-013"
                  required
                />
                <span className="help">Único dentro del estudio.</span>
              </div>

              <div className="field">
                <label htmlFor="iniciales">Iniciales *</label>
                <input id="iniciales" name="iniciales" type="text" maxLength={6} placeholder="MGL" required />
              </div>

              <div className="field">
                <label htmlFor="edad">Edad *</label>
                <input id="edad" name="edad" type="number" min={0} max={120} required />
              </div>

              <div className="field">
                <label htmlFor="sexo">Sexo *</label>
                <select id="sexo" name="sexo" required defaultValue="">
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                </select>
              </div>

              <div className="field">
                <label htmlFor="colorPiel">Color de piel</label>
                <input id="colorPiel" name="colorPiel" type="text" placeholder="Mestiza" />
              </div>

              <div className="field">
                <label htmlFor="peso">Peso (kg)</label>
                <input id="peso" name="peso" type="number" step="0.1" min="0.1" placeholder="70.5" />
              </div>

              <div className="field span-2">
                <label htmlFor="antecedentes">Antecedentes</label>
                <textarea
                  id="antecedentes"
                  name="antecedentes"
                  placeholder="Hipertensión arterial, diabetes mellitus tipo 2…"
                />
              </div>

              <div className="field span-2">
                <label htmlFor="diagnostico">Diagnóstico</label>
                <input
                  id="diagnostico"
                  name="diagnostico"
                  type="text"
                  placeholder="Trombosis venosa profunda"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card identity">
          <div className="card-head">
            <h3>Identidad del paciente</h3>
            <Badge tone="brand">
              <Icon name="lock" size={13} /> Tabla separada
            </Badge>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="nombre">Nombre completo *</label>
                <input id="nombre" name="nombre" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="documento">Documento *</label>
                <input id="documento" name="documento" type="text" required />
              </div>
              <div className="field">
                <label htmlFor="telefono">Teléfono</label>
                <input id="telefono" name="telefono" type="tel" placeholder="+52 55 0000 0000" />
              </div>
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <label className="check">
                  <input type="checkbox" name="consentimiento" defaultChecked />
                  Consentimiento informado firmado
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="row">
          <button className="btn btn-primary" type="submit">
            <Icon name="plus" size={16} /> Crear paciente
          </button>
          <Link href="/pacientes" className="btn btn-ghost">
            Cancelar
          </Link>
          <span className="spacer" />
          <span className="small muted">
            El alta queda registrada en la auditoría con el rol y el estudio.
          </span>
        </div>
      </form>
    </>
  );
}
