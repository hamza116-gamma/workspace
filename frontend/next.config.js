/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The monorepo root has its own lockfile; keep Next scoped to this app.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // Dev only: let other devices on the network open the app by IP
  // (e.g. http://10.10.99.94:3000). "*.*.*.*" matches any IPv4 address.
  allowedDevOrigins: ['*.*.*.*', '*.local'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

module.exports = nextConfig;
