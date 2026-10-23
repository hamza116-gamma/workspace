/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The monorepo root has its own lockfile; keep Next scoped to this app.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Dev only: let other devices on the network open the app by IP
  // (e.g. http://10.10.99.94:3000). "*.*.*.*" matches any IPv4 address.
  allowedDevOrigins: ['*.*.*.*', '*.local'],
  // Production (Vercel): proxy /api/* to the API host (e.g. Render) so the
  // session cookie is first-party on the frontend's domain - Safari/Firefox
  // block third-party cookies. Set BACKEND_ORIGIN in the Vercel project.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN?.replace(/\/+$/, '');
    return backend ? [{ source: '/api/:path*', destination: `${backend}/api/:path*` }] : [];
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

module.exports = nextConfig;
