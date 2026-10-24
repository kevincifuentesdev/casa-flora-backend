import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
    globalIgnores([
        "dist/**",
        "coverage/**",
        "node_modules/**",
        "src/infrastructure/repository/generated/**",
    ]),
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        files: ["**/*.ts"],
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/consistent-type-imports": "error",
            "no-console": "error",
            eqeqeq: ["error", "always"],
        },
    },
    {
        files: ["prisma/**/*.ts", "src/server.ts", "src/infrastructure/services/logger.service.ts"],
        rules: { "no-console": "off" },
    },
);
