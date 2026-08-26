import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function tryPlugin(name) {
  try {
    return require(name);
  } catch {
    return null;
  }
}

const tailwindcss = tryPlugin('tailwindcss');
const autoprefixer = tryPlugin('autoprefixer');

/** @type {import('postcss-load-config').Config} */
export default {
  plugins: {
    ...(tailwindcss ? { tailwindcss: {} } : {}),
    ...(autoprefixer ? { autoprefixer: {} } : {}),
  },
};
