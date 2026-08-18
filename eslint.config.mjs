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
    // Capacitor native android platform: generated Gradle build output
    // and copied web assets, not source we own or want linted.
    "android/**",
  ]),
  // `domain/` is pure: every time-dependent function takes an explicit
  // `now: Date` so it can be tested at any instant and so the whole app
  // reads one clock. This makes that convention enforceable rather than
  // merely documented. Scoped to domain SOURCE only — tests construct
  // dates freely (with arguments), and `lib/`/`components/` are exactly
  // where reading the real clock is allowed to happen.
  {
    files: ["domain/**/*.ts", "domain/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "domain functions take explicit now: Date — no Date.now() in domain/.",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "domain functions take explicit now: Date — no argless new Date() in domain/.",
        },
      ],
    },
  },
]);

export default eslintConfig;
