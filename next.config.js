/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true
  },
  transpilePackages: ['@logicalclocks/tailwind-quartz']
}

module.exports = nextConfig