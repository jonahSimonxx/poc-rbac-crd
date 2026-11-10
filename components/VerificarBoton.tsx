'use client';

import { useActionState } from 'react';

import {
  verificarCadenaAction,
  type VerificacionState,
} from '@/app/(app)/auditoria/actions';
import { fecha } from '@/lib/format';
import { Icon } from './Icon';

export function VerificarBoton({ inicial }: { inicial: VerificacionState }) {
  const [estado, action, pending] = useActionState<VerificacionState | null, FormData>(
    verificarCadenaAction,
    inicial,
  );

  const dato = estado ?? inicial;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Integridad de la pista</h3>
        <span className="hint">SHA-256 encadenado</span>
      </div>
      <div className="card-body">
        <div className={`chain${dato.integra ? '' : ' broken'}`}>
          <span className="chain-icon">
            <Icon name={dato.integra ? 'shield' : 'alert'} size={24} />
          </span>
          <div>
            <div className="chain-title">
              {dato.error
                ? 'No se pudo verificar'
                : dato.integra
                  ? 'La cadena es íntegra'
                  : 'La cadena está alterada'}
            </div>
            <div className="chain-sub">
              {dato.error ??
                (dato.integra
                  ? `${dato.total} registros verificados sin discrepancias.`
                  : `Primer registro inconsistente: #${dato.primerError}`)}
            </div>
          </div>
          <span className="spacer" />
          <form action={action}>
            <button className="btn btn-ghost btn-sm" type="submit" disabled={pending}>
              <Icon name="activity" size={15} />
              {pending ? 'Verificando…' : 'Verificar de nuevo'}
            </button>
          </form>
        </div>

        <p className="small muted" style={{ margin: '14px 0 0' }}>
          Última verificación: {fecha(dato.fecha)}. La comprobación la ejecuta PostgreSQL con{' '}
          <span className="mono">verificar_auditoria()</span>, no el código de la aplicación.
        </p>
      </div>
    </div>
  );
}
