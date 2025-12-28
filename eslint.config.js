import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextConfig,
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off'
    }
  }
];

export default config;
