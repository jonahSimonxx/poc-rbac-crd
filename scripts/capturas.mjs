// Capturas de pantalla de la POC para el repositorio.
// Requiere el servidor levantado en http://localhost:3100 y Microsoft Edge instalado.
// Uso: node scripts/capturas.mjs

import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const OUT = 'docs/capturas';
const PASSWORD = 'Demo2026!';

const ESTUDIO_ENOXA = '916b2d65-3519-4f47-8cd2-3baf74d97ec3';
const ESTUDIO_GRANI = '922439c2-b781-48ff-8c1f-bb8712b4bc16';
const PACIENTE_ENOXA = '2471b29f-b6bc-4e7e-879c-c5de3f3852c7';
const PACIENTE_GRANI = '6d286d6e-7099-4a88-8a1b-462fc397a9a8';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  locale: 'es-ES',
});
const page = await context.newPage();

async function esperar() {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(350);
}

async function login(email) {
  await context.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', email);
  await page.fill('#password', PASSWORD);
  await Promise.all([
    page.waitForURL('**/panel', { waitUntil: 'networkidle' }),
    page.click('button[type=submit]:has-text("Entrar")'),
  ]);
  await esperar();
}

async function ir(ruta, esperaTexto) {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
  if (esperaTexto) await page.getByText(esperaTexto, { exact: false }).first().waitFor();
  await esperar();
}

async function captura(nombre, { completa = false } = {}) {
  await page.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: completa });
  console.log(`captura: ${nombre}.png`);
}

async function desplazar(titulo) {
  await page
    .getByRole('heading', { name: titulo })
    .first()
    .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
  await page.waitForTimeout(300);
}

try {
  // 1. Inicio de sesión con las cuentas de demostración.
  await context.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await esperar();
  await captura('01-inicio-sesion', { completa: true });

  // 2. Panel del administrador: cuentas, estructura y auditoría administrativa.
  await login('admin@sim.local');
  await captura('02-panel-administrador', { completa: true });
  await ir('/usuarios', 'Usuarios');
  await captura('03-usuarios');
  await ir('/asignaciones', 'Asignaciones');
  await captura('04-asignaciones');

  // 3. Administrador fuera de la clínica: el acceso a pacientes se deniega.
  await ir('/pacientes', 'Acceso restringido');
  await captura('05-administrador-sin-acceso-clinico');

  // 4. Panel del jefe de estudio: supervisión sin escritura clínica.
  await login('jefe.enoxa@sim.local');
  await captura('06-panel-jefe-estudio', { completa: true });
  await ir('/pacientes', 'Pacientes');
  await captura('07-pacientes-ambito-estudio', { completa: true });

  // 5. Detalle del paciente: identidad separada, CRD, dosis y eventos.
  await ir(`/pacientes/${PACIENTE_ENOXA}`, 'Cuaderno de recogida de datos');
  await captura('08-paciente-detalle');
  await desplazar('Cuaderno de recogida de datos');
  await captura('09-paciente-crd');
  await desplazar('Auditoría de este paciente');
  await captura('10-paciente-auditoria');

  // 6. Acceso cruzado entre estudios: el jefe de ENOXA abre un paciente de GRANI.
  await ir(`/pacientes/${PACIENTE_GRANI}`, 'Acceso restringido');
  await captura('11-acceso-cruzado-denegado');

  // 7. El jefe del estudio afectado ve el intento denegado en su auditoría.
  await login('jefe.grani@sim.local');
  await ir(`/auditoria?estudio=${ESTUDIO_GRANI}&resultado=denegado`, 'Pista de auditoría');
  const denegados = await page.locator('table.data tbody tr').count();
  console.log(`filas denegadas visibles: ${denegados}`);
  if (denegados === 0) throw new Error('La captura de denegaciones quedaría vacía');
  await captura('12-auditoria-denegados');

  // 8. Verificación de la cadena SHA-256 ejecutada por PostgreSQL.
  await ir('/auditoria', 'Integridad de la pista');
  await page.getByRole('button', { name: 'Verificar de nuevo' }).click();
  await page.getByText('registros verificados', { exact: false }).first().waitFor();
  await esperar();
  await page.getByRole('heading', { name: 'Integridad de la pista' }).scrollIntoViewIfNeeded();
  await captura('13-auditoria-integridad');

  // 9. Médico investigador: escritura y firma dentro de su estudio.
  await login('inv.enoxa.hsa@sim.local');
  await captura('14-panel-medico-investigador', { completa: true });
  await ir(`/pacientes/${PACIENTE_ENOXA}`, 'Cuaderno de recogida de datos');
  await desplazar('Cuaderno de recogida de datos');
  await captura('15-medico-firma-crd');

  // 10. Auditoría administrativa: el administrador no ve la pista clínica.
  await login('admin@sim.local');
  await ir('/auditoria', 'Pista de auditoría');
  await captura('16-auditoria-administrativa');

  console.log('Capturas completadas.');
} finally {
  await browser.close();
}
