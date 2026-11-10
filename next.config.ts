import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pg es un modulo nativo de Node: no debe empaquetarse en el bundle.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
