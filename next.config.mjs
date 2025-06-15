import {createMDX} from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
    ],
  },
  // Support for `import chart from "./chart.mmd"`
  turbopack: {
    rules: {
      '*.mmd': {
        loaders: ["raw-loader"],
        as: "*.js"
      }
    }
  }
};

export default withMDX(config);
