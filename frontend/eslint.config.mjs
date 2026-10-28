import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// Next.js 16 uses ESLint flat config (eslint-config-next needs ESLint 9).
const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // React Compiler advisory rules (new in eslint-plugin-react-hooks 7).
    // Existing code uses these patterns widely and correctly without the
    // compiler; keep them visible as warnings instead of failing lint.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'node_modules/**']),
]);

export default eslintConfig;
