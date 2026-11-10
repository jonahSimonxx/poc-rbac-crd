// ============================================================
//  Conexion a PostgreSQL
//
//  La aplicacion usa DATABASE_URL, que apunta al rol crd_app:
//  sin UPDATE/DELETE sobre auditoria y sin DELETE en ninguna tabla.
// ============================================================

import { Pool } from 'pg';

const globalParaPg = globalThis as unknown as { __crdPool?: Pool };

export const pool =
  globalParaPg.__crdPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalParaPg.__crdPool = pool;
}
