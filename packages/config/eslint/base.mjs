export default [
  {
    ignores: ["dist/**", ".next/**", "coverage/**", "node_modules/**"]
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error"
    }
  }
];

