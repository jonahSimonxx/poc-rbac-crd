import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'CRD Farmacovigilancia · RBAC',
  description:
    'Prueba de concepto del control de acceso basado en roles para el cuaderno de recogida de datos de farmacovigilancia.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
