/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Removed static export to enable API routes for Auth0
  // output: 'export',
  images: {
    unoptimized: true
  },
  transpilePackages: ['@logicalclocks/tailwind-quartz']
}

module.exports = nextConfig