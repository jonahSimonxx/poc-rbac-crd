import test from 'node:test';
import assert from 'node:assert/strict';

import { can } from '../src/core/policy.ts';
import { ambitoDe, filtrarPorAmbito, tieneAccesoAlEstudio } from '../src/core/scope.ts';
import { ENOXA, GRANI, recurso, sujeto, sujetoCon } from './fixtures.ts';

test('AC-07: usuario inactivo no accede aunque tenga asignaciones', () => {
  const inactivo = sujeto('medico-investigador', ENOXA, { activo: false });
  const decision = can(inactivo, 'paciente:read', recurso('paciente', ENOXA));

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'usuario_inactivo');
});

test('una asignacion dada de baja no concede acceso', () => {
  const dadoDeBaja = sujeto('medico-investigador', ENOXA, { asignacionActiva: false });
  const decision = can(dadoDeBaja, 'paciente:read', recurso('paciente', ENOXA));

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'sin_asignacion');
});

test('un usuario sin asignaciones no accede a nada', () => {
  const sinAsignaciones = sujetoCon('u-nadie', []);
  const decision = can(sinAsignaciones, 'paciente:read', recurso('paciente', ENOXA));

  assert.equal(decision.permitido, false);
  assert.equal(decision.motivo, 'sin_asignacion');
});

test('ambitoDe: rol global ve todo', () => {
  const admin = sujeto('sys-admin', null);
  assert.deepEqual(ambitoDe(admin), { global: true, estudios: [] });
});

test('ambitoDe: roles de estudio solo ven sus estudios', () => {
  const medico = sujetoCon('u-medico', [
    { rol: 'medico-investigador', estudioId: ENOXA, activa: true },
    { rol: 'jefe-estudio', estudioId: GRANI, activa: true },
    { rol: 'medico-investigador', estudioId: GRANI, activa: false },
  ]);

  const ambito = ambitoDe(medico);
  assert.equal(ambito.global, false);
  assert.deepEqual([...ambito.estudios].sort(), [ENOXA, GRANI].sort());
});

test('tieneAccesoAlEstudio respeta el ambito', () => {
  const medico = sujeto('medico-investigador', ENOXA);

  assert.equal(tieneAccesoAlEstudio(medico, ENOXA), true);
  assert.equal(tieneAccesoAlEstudio(medico, GRANI), false);
  assert.equal(tieneAccesoAlEstudio(medico, null), false);

  const admin = sujeto('sys-admin', null);
  assert.equal(tieneAccesoAlEstudio(admin, GRANI), true);
});

test('filtrarPorAmbito deja solo los estudios propios', () => {
  const medico = sujeto('medico-investigador', ENOXA);
  const pacientes = [
    { id: 'p1', estudioId: ENOXA },
    { id: 'p2', estudioId: GRANI },
    { id: 'p3', estudioId: ENOXA },
    { id: 'p4', estudioId: null },
  ];

  const visibles = filtrarPorAmbito(medico, pacientes).map((p) => p.id);
  assert.deepEqual(visibles, ['p1', 'p3']);
});

test('filtrarPorAmbito: el rol global ve todo', () => {
  const admin = sujeto('sys-admin', null);
  const items = [
    { id: 'p1', estudioId: ENOXA },
    { id: 'p2', estudioId: GRANI },
    { id: 'p3', estudioId: null },
  ];

  assert.equal(filtrarPorAmbito(admin, items).length, 3);
});

test('filtrarPorAmbito: usuario inactivo no ve nada', () => {
  const inactivo = sujeto('medico-investigador', ENOXA, { activo: false });
  const items = [{ id: 'p1', estudioId: ENOXA }];

  assert.deepEqual(filtrarPorAmbito(inactivo, items), []);
});
