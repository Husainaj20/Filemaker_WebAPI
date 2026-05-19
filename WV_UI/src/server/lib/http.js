import fs from "node:fs/promises";
import path from "node:path";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

export async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) return {};

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
}

export function sendJson(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...headers
  });
  response.end(JSON.stringify(payload));
}

export async function sendStaticFile(response, absolutePath) {
  const extension = path.extname(absolutePath).toLowerCase();
  const type = MIME_TYPES[extension] || "application/octet-stream";
  const content = await fs.readFile(absolutePath);
  response.writeHead(200, { "content-type": type });
  response.end(content);
}

export function isSafePath(rootDir, targetPath) {
  const normalizedRoot = path.resolve(rootDir);
  const normalizedTarget = path.resolve(targetPath);
  return normalizedTarget.startsWith(normalizedRoot);
}
