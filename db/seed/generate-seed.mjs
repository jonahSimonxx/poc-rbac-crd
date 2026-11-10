// ============================================================
//  Generador de datos sinteticos para el POC
//
//  Uso:
//    node db/seed/generate-seed.mjs
//    -> escribe db/04-seed.sql
//
//  No usa dependencias: solo el runtime de Node.
//  Los datos son inventados. Del Excel de Enoxaparina se reutiliza
//  unicamente la ESTRUCTURA (codigos de inclusion, tomas repetidas,
//  columnas clinicas), nunca valores de pacientes reales.
// ============================================================

import { createHash, scryptSync } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', '04-seed.sql');

// ---------- PRNG determinista (mulberry32) ----------
let semilla = 20261109;
function rnd() {
  semilla |= 0;
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const chance = (p) => rnd() < p;

// ---------- utilidades ----------
function uuid(...partes) {
  const h = createHash('sha256').update(partes.join('|')).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const esc = (s) => (s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const num = (n) => (n === null || n === undefined ? 'NULL' : String(n));

function hashPassword(password) {
  const N = 16384, r = 8, p = 1;
  const salt = createHash('sha256').update(`salt|${password}`).digest('hex').slice(0, 32);
  const key = scryptSync(password, salt, 64, { N, r, p }).toString('hex');
  return `scrypt$${N}$${r}$${p}$${salt}$${key}`;
}

// ---------- catalogos ----------
const PASSWORD = 'Demo2026!';
const PASSWORD_HASH = hashPassword(PASSWORD);

const USUARIOS = [
  { key: 'admin',        email: 'admin@sim.local',          nombre: 'Ana Administradora',  rol: 'sys-admin',            estudio: null },
  { key: 'jefe-enoxa',   email: 'jefe.enoxa@sim.local',     nombre: 'Jorge Estrada',       rol: 'jefe-estudio',         estudio: 'ENOXA' },
  { key: 'jefe-grani',   email: 'jefe.grani@sim.local',     nombre: 'Lucia Moreno',        rol: 'jefe-estudio',         estudio: 'GRANI' },
  { key: 'inv-enoxa-1',  email: 'inv.enoxa.hsa@sim.local',  nombre: 'Dr. Martin Salas',    rol: 'medico-investigador',  estudio: 'ENOXA' },
  { key: 'inv-enoxa-2',  email: 'inv.enoxa.hsb@sim.local',  nombre: 'Dra. Paula Rios',     rol: 'medico-investigador',  estudio: 'ENOXA' },
  { key: 'inv-grani-1',  email: 'inv.grani.hga@sim.local',  nombre: 'Dr. Ivan Peralta',    rol: 'medico-investigador',  estudio: 'GRANI' },
];

const ESTUDIOS = [
  {
    key: 'ENOXA',
    codigo: 'ENOXA',
    nombre: 'Enoxaparina en profilaxis de eventos tromboembolicos',
    patrocinador: 'SIM',
    lote: 'ES 250003',
    dosis: [40, 60, 80],
    via: ['SC', 'IV'],
    sitios: [
      { key: 'HSA', codigo: 'HSA', nombre: 'Hospital San Antonio',  pacientes: 12 },
      { key: 'HSB', codigo: 'HSB', nombre: 'Hospital Santa Barbara', pacientes: 10 },
      { key: 'HSC', codigo: 'HSC', nombre: 'Hospital San Carlos',   pacientes: 8 },
    ],
  },
  {
    key: 'GRANI',
    codigo: 'GRANI',
    nombre: 'Granisetron en profilaxis de nauseas postquimioterapia',
    patrocinador: 'SIM',
    lote: 'GR 250011',
    dosis: [1, 2, 3],
    via: ['IV'],
    sitios: [
      { key: 'HGA', codigo: 'HGA', nombre: 'Hospital General de Aragua', pacientes: 12 },
      { key: 'HGB', codigo: 'HGB', nombre: 'Hospital General de Barinas', pacientes: 8 },
    ],
  },
];

const DIAGNOSTICOS = [
  'Trombosis venosa profunda', 'Tromboembolismo pulmonar', 'Fibrilacion auricular',
  'Sindrome coronario agudo', 'Neumonia bacteriana', 'Insuficiencia cardiaca congestiva',
  'Cirugia ortopedica de cadera', 'Cancer de mama en tratamiento', 'Diabetes mellitus tipo 2',
  'Sepsis de origen abdominal',
];

const ANTECEDENTES = [
  'Hipertension arterial', 'Diabetes mellitus tipo 2', 'EPOC', 'Insuficiencia renal cronica',
  'Cardiopatia isquemica', 'Obesidad', 'Tabaquismo', 'Sin antecedentes relevantes',
];

const COLORES = ['Mestiza', 'Blanca', 'Negra', 'Asiatica'];
const NOMBRES = ['Maria', 'Jose', 'Ana', 'Luis', 'Carmen', 'Pedro', 'Rosa', 'Miguel', 'Elena', 'Carlos', 'Sofia', 'Javier'];
const APELLIDOS = ['Garcia', 'Lopez', 'Martinez', 'Rodriguez', 'Fernandez', 'Perez', 'Gomez', 'Diaz', 'Torres', 'Ramirez'];

const EVENTOS = [
  { d: 'Nauseas y vomito', g: 'leve' },
  { d: 'Cefalea intensa', g: 'leve' },
  { d: 'Hematoma en sitio de inyeccion', g: 'leve' },
  { d: 'Trombocitopenia leve', g: 'moderada' },
  { d: 'Reaccion alergica cutanea', g: 'moderada' },
  { d: 'Hemorragia digestiva', g: 'grave' },
  { d: 'Sangrado en sitio quirurgico', g: 'grave' },
];

// ---------- construccion ----------
const L = [];
const q = (s) => L.push(s);

q('-- ============================================================');
q('--  04 - Datos sinteticos del POC');
q('--  Generado por db/seed/generate-seed.mjs');
q('--  NO contiene datos de pacientes reales.');
q('--  Ejecutar como crd_owner:');
q('--    psql -U crd_owner -d crd_rbac_poc -f db/04-seed.sql');
q('-- ============================================================');
q('');
q('BEGIN;');
q('');

// --- usuarios ---
q('-- Usuarios sinteticos. Contrasena para todos: ' + PASSWORD);
q('INSERT INTO usuario (id, email, nombre, password_hash) VALUES');
const userRows = USUARIOS.map((u) =>
  `  (${esc(uuid('usuario', u.key))}, ${esc(u.email)}, ${esc(u.nombre)}, ${esc(PASSWORD_HASH)})`
);
q(userRows.join(',\n') + '\nON CONFLICT (email) DO NOTHING;');
q('');

const userId = (key) => uuid('usuario', key);

// --- estudios ---
q('-- Estudios');
q('INSERT INTO estudio (id, codigo, nombre, patrocinador, creado_por) VALUES');
q(ESTUDIOS.map((e) =>
  `  (${esc(uuid('estudio', e.key))}, ${esc(e.codigo)}, ${esc(e.nombre)}, ${esc(e.patrocinador)}, ${esc(userId('admin'))})`
).join(',\n') + '\nON CONFLICT (codigo) DO NOTHING;');
q('');

// --- sitios ---
q('-- Sitios');
q('INSERT INTO sitio (id, estudio_id, codigo, nombre) VALUES');
const sitioRows = [];
for (const e of ESTUDIOS)
  for (const s of e.sitios)
    sitioRows.push(`  (${esc(uuid('sitio', e.key, s.key))}, ${esc(uuid('estudio', e.key))}, ${esc(s.codigo)}, ${esc(s.nombre)})`);
q(sitioRows.join(',\n') + '\nON CONFLICT (estudio_id, codigo) DO NOTHING;');
q('');

// --- asignaciones ---
q('-- Asignaciones: usuario + estudio + rol (estudio NULL = rol global)');
q('INSERT INTO asignacion (id, usuario_id, estudio_id, rol_codigo, activa, creada_por) VALUES');
const asigRows = USUARIOS.map((u) =>
  `  (${esc(uuid('asignacion', u.key))}, ${esc(userId(u.key))}, ${u.estudio ? esc(uuid('estudio', u.estudio)) : 'NULL'}, ${esc(u.rol)}, true, ${esc(userId('admin'))})`
);
q(asigRows.join(',\n') + '\nON CONFLICT DO NOTHING;');
q('');

// --- pacientes ---
const pacientes = []; // {id, estudio, sitio, codigo, creadoPor, ...}

for (const e of ESTUDIOS) {
  const investigadores = USUARIOS.filter((u) => u.estudio === e.key && u.rol === 'medico-investigador');
  for (const s of e.sitios) {
    for (let i = 1; i <= s.pacientes; i++) {
      const codigo = `${s.codigo}-${String(i).padStart(3, '0')}`;
      const sexo = chance(0.5) ? 'M' : 'F';
      const iniciales = `${pick(NOMBRES)[0]}${pick(APELLIDOS)[0]}${pick(APELLIDOS)[0]}`;
      const creadoPor = pick(investigadores).key;
      pacientes.push({
        id: uuid('paciente', e.key, s.key, codigo),
        estudioKey: e.key,
        sitioKey: s.key,
        sitioId: uuid('sitio', e.key, s.key),
        estudioId: uuid('estudio', e.key),
        codigo,
        iniciales,
        edad: int(18, 84),
        sexo,
        color: pick(COLORES),
        peso: (int(450, 980) / 10).toFixed(1),
        aporte: pick(ANTECEDENTES),
        diagnostico: pick(DIAGNOSTICOS),
        creadoPor,
        creadoEn: int(1, 120),
        nombre: `${pick(NOMBRES)} ${pick(APELLIDOS)} ${pick(APELLIDOS)}`,
        documento: `DOC-${int(10000000, 99999999)}`,
        telefono: `+52 55 ${int(1000, 9999)} ${int(1000, 9999)}`,
        consentimiento: chance(0.9),
      });
    }
  }
}

q('-- Pacientes (datos clinicos, sin identidad)');
q('INSERT INTO paciente (id, estudio_id, sitio_id, codigo, iniciales, edad, sexo, color_piel, peso_kg, antecedentes, diagnostico, creado_por, creado_en) VALUES');
q(pacientes.map((p) =>
  `  (${esc(p.id)}, ${esc(p.estudioId)}, ${esc(p.sitioId)}, ${esc(p.codigo)}, ${esc(p.iniciales)}, ${p.edad}, ${esc(p.sexo)}, ${esc(p.color)}, ${p.peso}, ${esc(p.aporte)}, ${esc(p.diagnostico)}, ${esc(userId(p.creadoPor))}, now() - interval '${p.creadoEn} days')`
).join(',\n') + '\nON CONFLICT (estudio_id, codigo) DO NOTHING;');
q('');

q('-- Identidad del paciente (tabla separada)');
q('INSERT INTO identidad_paciente (paciente_id, nombre, documento, telefono, consentimiento_firmado, consentimiento_fecha) VALUES');
q(pacientes.map((p) =>
  `  (${esc(p.id)}, ${esc(p.nombre)}, ${esc(p.documento)}, ${esc(p.telefono)}, ${p.consentimiento}, ${p.consentimiento ? `current_date - ${int(1, 120)}` : 'NULL'})`
).join(',\n') + '\nON CONFLICT (paciente_id) DO NOTHING;');
q('');

// --- CRD ---
const crdRows = [];
const crdFirmados = [];
for (const p of pacientes) {
  const firmado = chance(0.7);
  const firmadoPor = firmado ? userId(p.creadoPor) : 'NULL';
  const firmadoEn = firmado ? `now() - interval '${Math.max(1, p.creadoEn - 2)} days'` : 'NULL';
  const estado = firmado ? 'firmado' : 'borrador';
  crdRows.push(`  (${esc(uuid('crd', p.codigo, 'inclusion', 1))}, ${esc(p.id)}, 'inclusion', 1, ${esc(JSON.stringify({ fecha_inclusion: `2026-0${int(1, 9)}-1${int(0, 9)}`, cumple_criterios: true }))}::jsonb, '${estado}', ${firmado ? esc(firmadoPor) : 'NULL'}, ${firmadoEn}, ${esc(userId(p.creadoPor))}, now() - interval '${p.creadoEn} days')`);
  if (firmado) crdFirmados.push({ p, tipo: 'inclusion', visita: 1 });

  if (chance(0.6)) {
    const firmadoIni = chance(0.6);
    crdRows.push(`  (${esc(uuid('crd', p.codigo, 'evaluacion_inicial', 1))}, ${esc(p.id)}, 'evaluacion_inicial', 1, ${esc(JSON.stringify({ peso_kg: Number(p.peso), talla_cm: int(150, 185), ta: `${int(100, 140)}/${int(60, 90)}`, fc: int(60, 100) }))}::jsonb, '${firmadoIni ? 'firmado' : 'borrador'}', ${firmadoIni ? esc(userId(p.creadoPor)) : 'NULL'}, ${firmadoIni ? `now() - interval '${Math.max(1, p.creadoEn - 5)} days'` : 'NULL'}, ${esc(userId(p.creadoPor))}, now() - interval '${Math.max(1, p.creadoEn - 3)} days')`);
    if (firmadoIni) crdFirmados.push({ p, tipo: 'evaluacion_inicial', visita: 1 });
  }
}

q('-- CRD');
q('INSERT INTO crd (id, paciente_id, tipo, visita, datos, estado, firmado_por, firmado_en, creado_por, creado_en) VALUES');
q(crdRows.join(',\n') + '\nON CONFLICT (paciente_id, tipo, visita) DO NOTHING;');
q('');

// --- dosis ---
const dosisRows = [];
for (const p of pacientes) {
  const e = ESTUDIOS.find((x) => x.key === p.estudioKey);
  const tomas = int(3, 10);
  for (let t = 1; t <= tomas; t++) {
    dosisRows.push(`  (${esc(uuid('dosis', p.codigo, t))}, ${esc(p.id)}, ${t}, ${esc(e.lote)}, ${pick(e.dosis)}, ${esc(pick(e.via))}, now() - interval '${Math.max(0, p.creadoEn - t)} days', ${esc(userId(p.creadoPor))})`);
  }
}

q('-- Dosis: una fila por toma');
q('INSERT INTO dosis (id, paciente_id, numero_toma, lote, dosis_mg, via, fecha_hora, creado_por) VALUES');
q(dosisRows.join(',\n') + '\nON CONFLICT (paciente_id, numero_toma) DO NOTHING;');
q('');

// --- eventos adversos ---
const eventoRows = [];
const eventosCreados = [];
for (const p of pacientes) {
  if (!chance(0.35)) continue;
  const ev = pick(EVENTOS);
  const causal = pick(['no_relacionada', 'posible', 'probable', 'definitiva']);
  eventoRows.push(
    `  (${esc(uuid('evento', p.codigo))}, ${esc(p.id)}, ${esc(ev.d)}, ${esc(ev.g)}, ${esc(causal)}, ${esc(pick(['recuperado', 'en seguimiento', 'secuela']))}, current_date - ${int(10, 90)}, ${chance(0.6) ? 'current_date - ' + int(1, 9) : 'NULL'}, ${esc(userId(p.creadoPor))}, now() - interval '${int(1, 60)} days')`
  );
  eventosCreados.push({ p, ev });
}

q('-- Eventos adversos');
q('INSERT INTO evento_adverso (id, paciente_id, descripcion, gravedad, causalidad, desenlace, fecha_inicio, fecha_fin, creado_por, creado_en) VALUES');
q(eventoRows.join(',\n') + '\nON CONFLICT (id) DO NOTHING;');
q('');

// --- auditoria inicial ---
q('-- Auditoria inicial (solo si la tabla esta vacia).');
q('-- Los hashes los calcula el trigger auditoria_encadenar().');
q('INSERT INTO auditoria (fecha, usuario_id, rol_codigo, estudio_id, entidad, entidad_id, accion, resultado, detalle)');
q('SELECT * FROM (VALUES');

const auditRows = [];
const admin = userId('admin');
const jefeEnoxa = userId('jefe-enoxa');
const invEnoxa = userId('inv-enoxa-1');
const invGrani = userId('inv-grani-1');
const estEnoxa = uuid('estudio', 'ENOXA');
const estGrani = uuid('estudio', 'GRANI');

auditRows.push(`(now() - interval '9 days', ${esc(admin)}::uuid, 'sys-admin', NULL::uuid, 'usuario', 'admin', 'login', 'permitido', '{"ip":"127.0.0.1"}'::jsonb)`);
auditRows.push(`(now() - interval '9 days', ${esc(admin)}, 'sys-admin', NULL::uuid, 'asignacion', 'jefe-enoxa', 'create', 'permitido', '{"estudio":"ENOXA"}'::jsonb)`);
auditRows.push(`(now() - interval '8 days', ${esc(jefeEnoxa)}, 'jefe-estudio', ${esc(estEnoxa)}, 'estudio', 'ENOXA', 'read', 'permitido', '{"vista":"panel"}'::jsonb)`);
auditRows.push(`(now() - interval '8 days', ${esc(jefeEnoxa)}, 'jefe-estudio', ${esc(estEnoxa)}, 'crd', 'inclusion', 'sign', 'denegado', '{"motivo":"el jefe de estudio no firma datos clinicos"}'::jsonb)`);
auditRows.push(`(now() - interval '7 days', ${esc(invEnoxa)}, 'medico-investigador', ${esc(estEnoxa)}, 'paciente', 'HSA-001', 'create', 'permitido', '{}'::jsonb)`);

for (let i = 0; i < Math.min(8, crdFirmados.length); i++) {
  const c = crdFirmados[i];
  auditRows.push(`(now() - interval '${int(2, 6)} days', ${esc(userId(c.p.creadoPor))}, 'medico-investigador', ${esc(c.p.estudioId)}, 'crd', ${esc(c.p.codigo + '/' + c.tipo)}, 'sign', 'permitido', '{}'::jsonb)`);
}

auditRows.push(`(now() - interval '5 days', ${esc(invGrani)}, 'medico-investigador', ${esc(estGrani)}, 'paciente', 'HGA-001', 'read', 'denegado', '{"motivo":"sin asignacion al estudio ENOXA"}'::jsonb)`);
auditRows.push(`(now() - interval '4 days', ${esc(invEnoxa)}, 'medico-investigador', ${esc(estEnoxa)}, 'identidad_paciente', 'HSA-001', 'read', 'permitido', '{}'::jsonb)`);
auditRows.push(`(now() - interval '3 days', ${esc(admin)}, 'sys-admin', NULL::uuid, 'auditoria', 'clinica', 'read', 'denegado', '{"motivo":"el administrador no accede a auditoria clinica"}'::jsonb)`);
auditRows.push(`(now() - interval '2 days', ${esc(jefeEnoxa)}, 'jefe-estudio', ${esc(estEnoxa)}, 'auditoria', 'ENOXA', 'read', 'permitido', '{"vista":"auditoria"}'::jsonb)`);
auditRows.push(`(now() - interval '1 days', ${esc(jefeEnoxa)}, 'jefe-estudio', ${esc(estEnoxa)}, 'paciente', 'HSB-004', 'read', 'permitido', '{}'::jsonb)`);

q(auditRows.join(',\n'));
q(') AS v(fecha, usuario_id, rol_codigo, estudio_id, entidad, entidad_id, accion, resultado, detalle)');
q('WHERE NOT EXISTS (SELECT 1 FROM auditoria);');
q('');

q('COMMIT;');
q('');
q('-- Resumen');
q("SELECT 'usuarios' AS tabla, count(*) FROM usuario");
q('UNION ALL SELECT \'estudios\', count(*) FROM estudio');
q('UNION ALL SELECT \'sitios\', count(*) FROM sitio');
q('UNION ALL SELECT \'asignaciones\', count(*) FROM asignacion');
q('UNION ALL SELECT \'pacientes\', count(*) FROM paciente');
q('UNION ALL SELECT \'identidades\', count(*) FROM identidad_paciente');
q('UNION ALL SELECT \'crd\', count(*) FROM crd');
q('UNION ALL SELECT \'dosis\', count(*) FROM dosis');
q('UNION ALL SELECT \'eventos_adversos\', count(*) FROM evento_adverso');
q("UNION ALL SELECT 'auditoria', count(*) FROM auditoria;");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, L.join('\n') + '\n', 'utf8');

console.log(`Generado: ${OUT}`);
console.log(`  pacientes: ${pacientes.length}`);
console.log(`  dosis:     ${dosisRows.length}`);
console.log(`  crd:       ${crdRows.length}`);
console.log(`  eventos:   ${eventoRows.length}`);
console.log(`  auditoria: ${auditRows.length}`);
