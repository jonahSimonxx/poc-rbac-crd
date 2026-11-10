// ============================================================
//  Imprime la matriz de permisos por rol
//  Uso: npm run matriz
// ============================================================

import { PERMISOS, ROLES, ROLES_LISTA } from '../core/catalog.ts';

const SI = 'si';
const NO = '.';

const anchoPermiso = Math.max(...PERMISOS.map((p) => p.length)) + 2;
const anchosRol = ROLES_LISTA.map((r) => Math.max(r.length, 3) + 2);

function linea(): string {
  return '+' + '-'.repeat(anchoPermiso) + '+' + anchosRol.map((a) => '-'.repeat(a)).join('+') + '+';
}

function fila(celdas: string[]): string {
  return '|' + ' ' + celdas[0].padEnd(anchoPermiso - 1) + '|' +
    celdas.slice(1).map((c, i) => ' ' + c.padEnd(anchosRol[i] - 1) + '|').join('');
}

console.log('');
console.log('  Matriz de permisos - POC RBAC CRD de farmacovigilancia');
console.log('');
console.log(linea());
console.log(fila(['permiso', ...ROLES_LISTA]));
console.log(linea());

for (const permiso of PERMISOS) {
  console.log(fila([
    permiso,
    ...ROLES_LISTA.map((r) =>
      (ROLES[r].permisos as readonly string[]).includes(permiso) ? SI : NO,
    ),
  ]));
}

console.log(linea());
console.log(fila(['TOTAL', ...ROLES_LISTA.map((r) => String(ROLES[r].permisos.length))]));
console.log(linea());
console.log('');
console.log(`  Permisos en el catalogo: ${PERMISOS.length}`);
console.log('');
