import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDirectory = path.join(projectRoot, "src");
const distDirectory = path.join(projectRoot, "dist");
const unpackedDirectory = path.join(distDirectory, "nightshade-dark-mode");
const zipPath = path.join(distDirectory, "nightshade-dark-mode.zip");

const manifest = JSON.parse(await readFile(path.join(sourceDirectory, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Expected a Manifest V3 extension");
if (manifest.version !== "0.1.0") throw new Error("Manifest version must match project version 0.1.0");

await rm(unpackedDirectory, { recursive: true, force: true });
await rm(zipPath, { force: true });
await mkdir(distDirectory, { recursive: true });
await cp(sourceDirectory, unpackedDirectory, { recursive: true });

const zip = spawnSync("zip", ["-qr", path.basename(zipPath), path.basename(unpackedDirectory)], {
  cwd: distDirectory,
  encoding: "utf8"
});
if (zip.status !== 0) throw new Error(zip.stderr || "zip failed");

console.log(`Built ${path.relative(projectRoot, unpackedDirectory)}`);
console.log(`Built ${path.relative(projectRoot, zipPath)}`);
