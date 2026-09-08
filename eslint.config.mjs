import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local build-verification output (gitignored, never deployed) —
    // eslint-config-next's defaults above don't cover these.
    ".next-admin-verify/**",
    ".next-soc-verify/**",
  ]),
  // A leading underscore marks a destructured field as deliberately dropped
  // (e.g. `const { id: _id, ...rest } = saved`) — don't flag it as unused.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
