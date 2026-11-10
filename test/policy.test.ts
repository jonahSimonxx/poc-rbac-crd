import test from 'node:test';
import assert from 'node:assert/strict';

import { PERMISOS, ROLES, ROLES_LISTA, validarCatalogo } from '../src/core/catalog.ts';
import { can, exigir } from '../src/core/policy.ts';
import { ENOXA, GRANI, recurso, sujeto, sujetoCon } from './fixtures.ts';

// ---------- catalogo ----------

test('catalogo: sin permisos desconocidos ni duplicados', () => {
  assert.deepEqual(validarCatalogo(), []);
});

test('AC-01: ningun rol concentra todos los permisos', () => {
  for (const rol of ROLES_LISTA) {
    assert.ok(
      ROLES[rol].permisos.length < PERMISOS.length,
      `${rol} no puede tener el catalogo completo`,
    );
  }
});

// ---------- sys-admin ----------

test('AC-04: sys-admin no accede a datos clinicos', () => {
  const admin = sujeto('sys-admin', null);

  const clinicos = [
    'paciente:read',
    'identidad:read',
    'crd:read',
    'crd:sign',
    'dosis:read',
    'evento:read',
    'auditoria_clinica:read',
  ] as const;

  for (const permiso of clinicos) {
    const decision = can(admin, permiso, recurso('paciente', ENOXA));
    assert.equal(decision.permitido, false, `sys-admin no deberia poder ${permiso}`);
    assert.equal(decision.motivo, 'permiso_no_otorgado');
  }
});

test('sys-admin gestiona usuarios, asignaciones y auditoria administrativa', () => {
  const admin = sujeto('sys-admin', null);

  assert.equal(can(admin, 'usuario:create', recurso('usuario', null)).permitido, true);
  assert.equal(can(admin, 'usuario:deactivate', recurso('usuario', null)).permitido, true);
  assert.equal(can(admin, 'asignacion:create', recurso('asignacion', ENOXA)).permitido, true);
  assert.equal(can(admin, 'asignacion:revoke', recurso('asignacion', ENOXA)).permitido, true);
  assert.equal(can(admin, 'auditoria_admin:read', recurso('auditoria_admin', null)).permitido, true);
});

// ---------- jefe-estudio ----------

test('jefe-estudio supervisa y audita su estudio', () => {
  const jefe = sujeto('jefe-estudio', ENOXA);

  assert.equal(can(jefe, 'paciente:read', recurso('paciente', ENOXA)).permitido, true);
  assert.equal(can(jefe, 'identidad:read', recurso('identidad', ENOXA)).permitido, true);
  assert.equal(can(jefe, 'crd:read', recurso('crd', ENOXA)).permitido, true);
  assert.equal(can(jefe, 'dosis:read', recurso('dosis', ENOXA)).permitido, true);
  assert.equal(can(jefe, 'evento:read', recurso('evento', ENOXA)).permitido, true);
  assert.equal(can(jefe, 'auditoria_clinica:read', recurso('auditoria_clinica', ENOXA)).permitido, true);
  assert.equal(can(jefe, 'exportacion:export', recurso('exportacion', ENOXA)).permitido, true);
});

test('AC-03: jefe-estudio no captura, edita ni firma datos clinicos', () => {
  const jefe = sujeto('jefe-estudio', ENOXA);

  const escrituras = [
    'paciente:create',
    'paciente:update',
    'paciente:annul',
    'identidad:create',
    'identidad:update',
    'crd:create',
    'crd:update',
    'crd:sign',
    'dosis:create',
    'evento:create',
  ] as const;

  for (const permiso of escrituras) {
    const decision = can(jefe, permiso, recurso('crd', ENOXA));
    assert.equal(decision.permitido, false, `jefe no deberia poder ${permiso}`);
    assert.equal(decision.motivo, 'permiso_no_otorgado');
  }
});

test('AC-02: jefe-estudio no cruza a otro estudio', () => {
  const jefe = sujeto('jefe-estudio', ENOXA);

  const decision = can(jefe, 'paciente:read', recurso('paciente', GRANI));
  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'fuera_de_ambito');

  const auditoria = can(jefe, 'auditoria_clinica:read', recurso('auditoria_clinica', GRANI));
  assert.equal(auditoria.permitido, false);
  assert.equal(auditoria.motivo, 'fuera_de_ambito');
});

test('jefe-estudio no lee auditoria administrativa', () => {
  const jefe = sujeto('jefe-estudio', ENOXA);
  const decision = can(jefe, 'auditoria_admin:read', recurso('auditoria_admin', null));
  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'permiso_no_otorgado');
});

// ---------- medico-investigador ----------

test('medico-investigador captura, firma y anula en su estudio', () => {
  const medico = sujeto('medico-investigador', ENOXA);

  const acciones = [
    'paciente:create',
    'paciente:update',
    'paciente:annul',
    'identidad:read',
    'identidad:create',
    'identidad:update',
    'crd:create',
    'crd:update',
    'crd:sign',
    'dosis:create',
    'evento:create',
  ] as const;

  for (const permiso of acciones) {
    assert.equal(
      can(medico, permiso, recurso('crd', ENOXA)).permitido,
      true,
      `medico deberia poder ${permiso}`,
    );
  }
});

test('AC-02: medico-investigador no accede a otro estudio', () => {
  const medico = sujeto('medico-investigador', ENOXA);
  const decision = can(medico, 'crd:sign', recurso('crd', GRANI));

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'fuera_de_ambito');
});

test('medico-investigador no administra ni audita', () => {
  const medico = sujeto('medico-investigador', ENOXA);

  const prohibidos = [
    'usuario:create',
    'usuario:deactivate',
    'estudio:create',
    'asignacion:create',
    'auditoria_clinica:read',
    'auditoria_admin:read',
  ] as const;

  for (const permiso of prohibidos) {
    assert.equal(
      can(medico, permiso, recurso('usuario', ENOXA)).permitido,
      false,
      `medico no deberia poder ${permiso}`,
    );
  }
});

// ---------- modelo de asignaciones ----------

test('un usuario puede tener roles distintos en estudios distintos', () => {
  const mixto = sujetoCon('u-mixto', [
    { rol: 'jefe-estudio', estudioId: GRANI, activa: true },
    { rol: 'medico-investigador', estudioId: ENOXA, activa: true },
  ]);

  // Medico en ENOXA
  assert.equal(can(mixto, 'crd:sign', recurso('crd', ENOXA)).permitido, true);

  // En GRANI solo es jefe: no firma. Tiene el permiso por su rol de ENOXA,
  // pero no en ese estudio: el motivo correcto es "fuera_de_ambito".
  const firmaGrani = can(mixto, 'crd:sign', recurso('crd', GRANI));
  assert.equal(firmaGrani.permitido, false);
  assert.equal(firmaGrani.motivo, 'fuera_de_ambito');

  // Jefe en GRANI: lee auditoria clinica de GRANI, no de ENOXA
  assert.equal(can(mixto, 'auditoria_clinica:read', recurso('auditoria_clinica', GRANI)).permitido, true);
  assert.equal(
    can(mixto, 'auditoria_clinica:read', recurso('auditoria_clinica', ENOXA)).motivo,
    'fuera_de_ambito',
  );
});

test('un jefe de estudio puede crear un estudio nuevo (recurso sin ambito)', () => {
  const jefe = sujeto('jefe-estudio', ENOXA);
  const nuevo = { tipo: 'estudio' as const, estudioId: null, nuevo: true };

  const d = can(jefe, 'estudio:create', nuevo);
  assert.equal(d.permitido, true);
  assert.equal(d.rol, 'jefe-estudio');

  // Sin la marca de "nuevo", el ambito no se puede resolver.
  const sinMarca = can(jefe, 'estudio:create', { tipo: 'estudio', estudioId: null });
  assert.equal(sinMarca.permitido, false);
  assert.equal(sinMarca.motivo, 'fuera_de_ambito');
});

test('un medico no puede crear estudios aunque el recurso sea nuevo', () => {
  const medico = sujeto('medico-investigador', ENOXA);
  const d = can(medico, 'estudio:create', { tipo: 'estudio', estudioId: null, nuevo: true });
  assert.equal(d.permitido, false);
  assert.equal(d.motivo, 'permiso_no_otorgado');
});

test('exigir() lanza cuando la decision es denegatoria', () => {
  const medico = sujeto('medico-investigador', ENOXA);

  assert.throws(
    () => exigir(medico, 'usuario:create', recurso('usuario', ENOXA)),
    /Acceso denegado/,
  );

  assert.doesNotThrow(() =>
    exigir(medico, 'crd:sign', recurso('crd', ENOXA)),
  );
});
