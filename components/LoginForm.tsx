'use client';

import { useActionState, useState } from 'react';

import { login, type LoginState } from '@/app/login/actions';
import { inicialesDe } from '@/lib/format';
import { Icon } from './Icon';

interface DemoUser {
  email: string;
  nombre: string;
  rol: string;
}

export function LoginForm({ demoUsers }: { demoUsers: DemoUser[] }) {
  const [state, action, pending] = useActionState<LoginState | null, FormData>(login, null);
  const [email, setEmail] = useState('admin@sim.local');
  const [password, setPassword] = useState('Demo2026!');

  return (
    <>
      <form action={action} className="form">
        {state?.error ? (
          <div className="notice notice-error">
            <Icon name="alert" size={16} />
            <span>{state.error}</span>
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {pending ? 'Verificando…' : 'Entrar'}
        </button>
      </form>

      <div className="demo-users">
        <div className="cap">Cuentas de demostración · contraseña Demo2026!</div>
        <div className="demo-list">
          {demoUsers.map((u) => (
            <button
              key={u.email}
              type="button"
              className="demo-chip"
              onClick={() => {
                setEmail(u.email);
                setPassword('Demo2026!');
              }}
            >
              <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                {inicialesDe(u.nombre)}
              </span>
              <span className="who">
                <strong>{u.nombre}</strong>
                <span>{u.email}</span>
              </span>
              <span className="spacer" />
              <span className="badge badge-neutral">{u.rol}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
