// Bundles each entry point into one self-contained file in plugin/dist/.
// plugin/dist/ is committed, because a plugin installs straight from the repository and users don't build it.
import { build } from "esbuild";

await build({
  entryPoints: ["src/statusline.ts", "src/setup.ts", "src/sync.ts"],
  outdir: "plugin/dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  // The oldest Node.js that setup accepts (MIN_NODE_MAJOR in src/setup.ts).
  target: "node20",
  legalComments: "none",
  logLevel: "warning",
});
