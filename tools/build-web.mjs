import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const root = process.cwd();
const outDir = resolve(root, "dist");
const tsEntries = [
  "apps/web/src/main.ts",
  "packages/core/src/content.ts",
  "packages/core/src/engine.ts",
  "packages/core/src/index.ts",
  "packages/core/src/rng.ts",
  "packages/core/src/types.ts"
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await transformHtml("apps/web/index.html", "index.html");
await copyFile("apps/web/src/style.css", "apps/web/src/style.css");
await cp("apps/web/assets", resolve(outDir, "apps/web/assets"), { recursive: true });

for (const entry of tsEntries) {
  await transformTs(entry, entry.replace(/\.ts$/, ".js"));
}

console.log("Built static web app to dist/");

async function transformHtml(sourcePath, outputPath) {
  const source = await readFile(sourcePath, "utf8");
  const html = source.replaceAll(".ts", ".js");
  await writeFile(resolve(outDir, outputPath), html);
}

async function transformTs(sourcePath, outputPath) {
  const source = await readFile(sourcePath, "utf8");
  const stripped = stripTypeScriptTypes(source, { mode: "transform" });
  const js = stripped.replace(/from\s+(['"])([^'"]+)\.ts\1/g, "from $1$2.js$1");
  await writeFileEnsured(resolve(outDir, outputPath), js);
}

async function copyFile(sourcePath, outputPath) {
  if (extname(sourcePath) === ".ts") {
    await transformTs(sourcePath, outputPath);
    return;
  }
  await writeFileEnsured(resolve(outDir, outputPath), await readFile(sourcePath));
}

async function writeFileEnsured(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  const rel = relative(root, filePath);
  if (rel.startsWith("..")) {
    throw new Error(`Refusing to write outside project: ${filePath}`);
  }
}
