module.exports = {
  root: true,
  env: {
    browser: true,
    es2020: true,
    node: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  plugins: [
    "@typescript-eslint",
    "react-hooks",
    "react-refresh",
    "jsdoc",
  ],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsdoc/recommended",
  ],
  rules: {
    // Example: enforce docs on exported functions & classes
    "jsdoc/require-jsdoc": [
      "warn",
      {
        require: {
          FunctionDeclaration: true,
          MethodDefinition: true,
          ClassDeclaration: true,
          ArrowFunctionExpression: false,
          FunctionExpression: false,
        },
      },
    ],
    // React 17+ new JSX transform
    "react/react-in-jsx-scope": "off",
  },
  settings: {
    jsdoc: {
      mode: "typescript",
    },
    react: {
      version: "detect",
    },
  },
};