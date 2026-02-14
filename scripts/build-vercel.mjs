// Build Vercel serverless functions with full dependency bundling.
// Uses createRequire banner so CJS packages work in ESM bundles.

import { build } from "esbuild";

const banner = `import{createRequire as __cr}from"module";const require=__cr(import.meta.url);`;

const shared = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  banner: { js: banner },
  // Node builtins are auto-external with platform=node.
  // Bundle all npm packages (no --packages=external).
  minify: false,
  sourcemap: false,
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ["server/vercel/trpc-handler.ts"],
    outfile: "api/trpc/[trpc].js",
  }),
  build({
    ...shared,
    entryPoints: ["server/vercel/oauth-handler.ts"],
    outfile: "api/oauth/callback.js",
  }),
  build({
    ...shared,
    entryPoints: ["server/vercel/cron-handler.ts"],
    outfile: "api/cron/check-deposits.js",
  }),
  build({
    ...shared,
    entryPoints: ["server/vercel/slots-callback-handler.ts"],
    outfile: "api/slots/callback.js",
  }),
]);

console.log("✓ Vercel functions bundled");
