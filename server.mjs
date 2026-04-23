import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, resolve } from "node:path";
import { stripTypeScriptTypes } from "node:module";

const root = process.cwd();
const port = Number.parseInt(process.env.PORT ?? "5173", 10);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".ts", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"]
]);

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === "/") {
      pathname = "/apps/web/index.html";
    }
    if (pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    const filePath = resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root) || !existsSync(filePath)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    const ext = extname(filePath);
    if (ext === ".ts") {
      const source = await readFile(filePath, "utf8");
      const code = stripTypeScriptTypes(source, { mode: "transform" });
      response.writeHead(200, {
        "content-type": mimeTypes.get(ext) ?? "text/javascript; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(code);
      return;
    }

    const bytes = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes.get(ext) ?? "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(bytes);
  } catch (error) {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.stack : String(error));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Backpack autobattler dev server: http://127.0.0.1:${port}`);
});
