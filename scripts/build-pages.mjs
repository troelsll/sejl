// Bygger en statisk version til GitHub Pages i dist/ (kører helt i browseren, ingen server).
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "server"), { recursive: true });
mkdirSync(join(dist, "vendor"), { recursive: true });

cpSync(join(root, "client"), dist, { recursive: true });
cpSync(join(root, "shared"), join(dist, "shared"), { recursive: true });
for (const file of ["api.mjs", "database.mjs", "websejlerAdapter.mjs"]) {
  cpSync(join(root, "server", file), join(dist, "server", file));
}
for (const file of ["sql-wasm.js", "sql-wasm.wasm"]) {
  cpSync(join(root, "node_modules/sql.js/dist", file), join(dist, "vendor", file));
}

const edit = (path, fn) => writeFileSync(path, fn(readFileSync(path, "utf8")));

// Relative stier, så siden virker under /<repo>/
for (const page of ["index.html", "display.html"]) {
  edit(join(dist, page), (html) =>
    html
      .replaceAll('href="/src/', 'href="src/')
      .replace(/<script type="module" src="\/src\/(\w+)\.js"><\/script>/, '<script type="module" src="src/local-backend.js"></script>\n    <script type="module" src="src/$1.js"></script>')
  );
}
for (const file of readdirSync(join(dist, "src")).filter((f) => f.endsWith(".js"))) {
  edit(join(dist, "src", file), (js) =>
    js.replaceAll("../../shared/", "../shared/").replaceAll("`/display.html?", "`display.html?")
  );
}
edit(join(dist, "shared/flags.mjs"), (js) => js.replaceAll("`/assets/class-flags/", "`assets/class-flags/"));

// Cache-busting: unik version på alle lokale filreferencer, så browsere altid henter nyeste CSS/JS efter deploy
const version = (process.env.GITHUB_SHA ?? String(Date.now())).slice(0, 12);
const importPattern = /((?:from\s*|import\s*\(\s*|import\s+)["'])(\.{1,2}\/[^"']+?\.m?js)(["'])/g;
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
for (const file of [...walk(join(dist, "src")), ...walk(join(dist, "shared")), ...walk(join(dist, "server"))].filter((f) => /\.m?js$/.test(f))) {
  edit(file, (js) => js.replace(importPattern, `$1$2?v=${version}$3`));
}
for (const page of ["index.html", "display.html"]) {
  edit(join(dist, page), (html) => html.replace(/(href|src)="(src\/[^"?]+)"/g, `$1="$2?v=${version}"`));
}
writeFileSync(join(dist, ".nojekyll"), "");
console.log("Bygget dist/");
