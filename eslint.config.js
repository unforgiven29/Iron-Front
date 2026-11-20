import tseslint from "typescript-eslint";

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    files: ["game/src/**/*.ts", "game/tests/**/*.ts"],
    rules: {
      "no-debugger": "error",
      "no-console": "error"
    }
  }
);
