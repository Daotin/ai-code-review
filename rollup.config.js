import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";

export default {
  input: "src/code-review.js",
  output: {
    file: "dist/index.js",
    format: "es",
    banner: "#!/usr/bin/env node",
    inlineDynamicImports: true,
  },
  external: ["fs", "path", "url", "child_process", "os"],
  plugins: [nodeResolve(), commonjs(), json(), terser()],
};
