/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Next 14.x + ESLint 9 can fail during `next build`; keep linting as a separate step.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
