import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // "Has this member left?" was hand-written in nine components and
    // forgotten in several more, which is how departed people ended up in
    // the Archive filters, the quick-room invite list and the command
    // palette. There is one answer now: useTeam() / activeMembers() in
    // TeamContext. TeamPanel and presence.ts are the two places that
    // legitimately render departed members, so they are exempt.
    files: ["app/**/*.tsx", "app/**/*.ts", "plugins/**/*.tsx"],
    ignores: [
      "app/(workspace)/dashboard/_components/TeamContext.tsx",
      "app/(workspace)/dashboard/_components/TeamPanel.tsx",
      "app/(workspace)/dashboard/_components/presence.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "BinaryExpression[operator=/^[!=]==$/][left.property.name='activityStatus'][right.value='left']",
          message:
            "Don't re-implement the departed-member rule. Pick from useTeam() (context) or activeMembers(list); use useDirectory() when resolving an id you already hold.",
        },
      ],
    },
  },
]);

export default eslintConfig;
