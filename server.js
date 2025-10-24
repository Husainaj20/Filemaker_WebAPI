import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// serve index.html and any static assets in this folder
app.use(express.static(__dirname));

/* ---------------- Mock route (no FileMaker needed) ---------------- */
app.get("/mock/requests", (req, res) => {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(__dirname, "package.json"), "utf8")
    );
    res.json(pkg.mockRequests || { response: { data: [] } });
  } catch (e) {
    res
      .status(500)
      .json({ messages: [{ code: "500", message: e.message }], response: {} });
  }
});

/* ---------------- FileMaker Data API proxy (unchanged contract) ---------------- */
const FM_SERVER = process.env.FM_SERVER; // e.g. https://10.56.12.24
const FM_DB = process.env.FM_DB; // e.g. new excessland management
const FM_LAYOUT = process.env.FM_LAYOUT; // e.g. Requests_API
const FM_USER = process.env.FM_USER;
const FM_PASS = process.env.FM_PASS;

async function getToken() {
  const url = `${FM_SERVER}/fmi/data/vLatest/databases/${encodeURIComponent(
    FM_DB
  )}/sessions`;
  const body = { fmDataSource: [{ database: FM_DB }] };
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`${FM_USER}:${FM_PASS}`).toString("base64"),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Login failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.response?.token;
}

app.get("/api/requests", async (_req, res) => {
  try {
    if (!FM_SERVER || !FM_DB || !FM_LAYOUT || !FM_USER || !FM_PASS) {
      return res.status(500).json({
        messages: [
          {
            code: "500",
            message: "FM env not set; use /mock/requests or configure .env",
          },
        ],
        response: {},
      });
    }
    const token = await getToken();
    const url = `${FM_SERVER}/fmi/data/vLatest/databases/${encodeURIComponent(
      FM_DB
    )}/layouts/${encodeURIComponent(FM_LAYOUT)}/records?_limit=25&_offset=1`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json();
    res.json(j);
  } catch (e) {
    res
      .status(500)
      .json({ messages: [{ code: "500", message: e.message }], response: {} });
  }
});

/* ---------------- Start server ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
  console.log(`Mock data:      http://localhost:${PORT}/?mock=1`);
  console.log(`Live FM:        http://localhost:${PORT}/  (requires .env)`);
});
