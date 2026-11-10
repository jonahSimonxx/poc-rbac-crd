import test from 'node:test';
import assert from 'node:assert/strict';

import { can } from '../src/core/policy.ts';
import { construirEntrada, motivoLegible, MOTIVOS } from '../src/core/auditoria.ts';
import { ENOXA, GRANI, recurso, sujeto } from './fixtures.ts';

// ---------- entrada permitida ----------

test('entrada permitida: registra accion y deja el detalle intacto', () => {
  const medico = sujeto('medico-investigador', ENOXA);
  const permiso = 'crd:sign' as const;
  const r = recurso('crd', ENOXA, 'crd-42');

  const decision = can(medico, permiso, r);
  const entrada = construirEntrada(medico, permiso, r, decision, { visita: 2 });

  assert.equal(entrada.resultado, 'permitido');
  assert.equal(entrada.rolCodigo, 'medico-investigador');
  assert.equal(entrada.estudioId, ENOXA);
  assert.equal(entrada.entidad, 'crd');
  assert.equal(entrada.accion, 'sign');
  assert.equal(entrada.entidadId, 'crd-42');
  assert.deepEqual(entrada.detalle, { visita: 2 });
});

test('entrada sin id usa "-" como identificador', () => {
  const admin = sujeto('sys-admin', null);
  const permiso = 'usuario:create' as const;
  const r = { tipo: 'usuario' as const, estudioId: null };

  const decision = can(admin, permiso, r);
  const entrada = construirEntrada(admin, permiso, r, decision);

  assert.equal(entrada.entidadId, '-');
  assert.equal(entrada.estudioId, null);
});

// ---------- entrada denegada ----------

test('entrada denegada: guarda motivo y explicacion legible', () => {
  const jefe = sujeto('jefe-estudio', ENOXA);
  const permiso = 'crd:sign' as const;
  const r = recurso('crd', ENOXA, 'crd-7');

  const decision = can(jefe, permiso, r);
  const entrada = construirEntrada(jefe, permiso, r, decision, { visita: 1 });

  assert.equal(decision.permitido, false);
  assert.equal(entrada.resultado, 'denegado');
  // El rol no se registra: no hubo rol que concediera la accion.
  assert.equal(entrada.rolCodigo, null);
  assert.equal(entrada.detalle.motivo, 'permiso_no_otorgado');
  assert.equal(entrada.detalle.explicacion, MOTIVOS.permiso_no_otorgado);
  // El detalle original se conserva junto al motivo.
  assert.equal(entrada.detalle.visita, 1);
});

test('entrada denegada por ambito registra "fuera_de_ambito"', () => {
  const medico = sujeto('medico-investigador', ENOXA);
  const permiso = 'paciente:read' as const;
  const r = recurso('paciente', GRANI, 'p-9');

  const decision = can(medico, permiso, r);
  const entrada = construirEntrada(medico, permiso, r, decision);

  assert.equal(entrada.resultado, 'denegado');
  assert.equal(entrada.detalle.motivo, 'fuera_de_ambito');
});

test('cada motivo tiene una explicacion en espanol', () => {
  for (const motivo of Object.keys(MOTIVOS) as Array<keyof typeof MOTIVOS>) {
    const texto = motivoLegible(motivo);
    assert.equal(typeof texto, 'string');
    assert.ok(texto.length > 0, `el motivo "${motivo}" no tiene explicacion`);
    assert.equal(texto, MOTIVOS[motivo]);
  }
});

// ---------- forma del permiso ----------

test('entidad y accion se derivan del permiso', () => {
  const admin = sujeto('sys-admin', null);

  const casos = [
    { permiso: 'auditoria_admin:read' as const, entidad: 'auditoria_admin', accion: 'read' },
    { permiso: 'asignacion:create' as const, entidad: 'asignacion', accion: 'create' },
    { permiso: 'paciente:annul' as const, entidad: 'paciente', accion: 'annul' },
  ];

  for (const c of casos) {
    const r = { tipo: c.entidad as never, estudioId: null };
    const decision = can(admin, c.permiso, r);
    const entrada = construirEntrada(admin, c.permiso, r, decision);
    assert.equal(entrada.entidad, c.entidad);
    assert.equal(entrada.accion, c.accion);
  }
});

// ---------- coherencia con la decision ----------

test('la entrada refleja siempre la decision del motor', () => {
  const sujetos = [
    sujeto('sys-admin', null),
    sujeto('jefe-estudio', ENOXA),
    sujeto('medico-investigador', ENOXA),
  ];
  const permisos = ['paciente:read', 'crd:sign', 'usuario:create'] as const;

  for (const s of sujetos) {
    for (const p of permisos) {
      const r = recurso('paciente', ENOXA);
      const decision = can(s, p, r);
      const entrada = construirEntrada(s, p, r, decision);

      assert.equal(entrada.resultado, decision.permitido ? 'permitido' : 'denegado');
      if (decision.permitido) {
        assert.equal(entrada.rolCodigo, decision.rol);
        assert.equal(entrada.detalle.motivo, undefined);
      } else {
        assert.equal(entrada.detalle.motivo, decision.motivo);
      }
    }
  }
});
