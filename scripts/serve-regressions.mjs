import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const name = url.pathname === "/" ? "test/browser/index.html" : decodeURIComponent(url.pathname).slice(1);
  const file = path.resolve(root, name);
  // Serve only synthetic fixtures and shipping JS/CSS. Never serve the user's
  // saved account page, repository metadata or arbitrary local paths.
  if (!file.startsWith(root + path.sep) || !/^(test\/browser\/|src\/).+\.(html|js|css|svg)$/.test(name)) {
    res.writeHead(404).end(); return;
  }
  try {
    res.writeHead(200, { "Content-Type": types[path.extname(file)], "Cache-Control": "no-store" });
    res.end(await fs.readFile(file));
  } catch { res.writeHead(404).end(); }
});
server.listen(8769, "127.0.0.1", () => console.log("Regression gallery: http://127.0.0.1:8769 (Ctrl-C to stop)"));
