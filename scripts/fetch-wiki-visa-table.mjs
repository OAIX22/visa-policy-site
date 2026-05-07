/**
 * 从英文维基百科「Visa requirements for Chinese citizens」页面拉取主签证表，
 * 写入 data/wiki-visa-table.txt（管道 + Markdown 链接格式），供 build-visa-seed.mjs 使用。
 *
 * 须遵守：https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
 * 运行：node scripts/fetch-wiki-visa-table.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "data", "wiki-visa-table.txt");

const WIKI_PAGE = "Visa_requirements_for_Chinese_citizens";
const API =
  "https://en.wikipedia.org/w/api.php?action=parse&page=" +
  encodeURIComponent(WIKI_PAGE) +
  "&prop=text&formatversion=2&format=json";

const UA =
  "VisaPolicySite/1.0 (https://github.com/OAIX22/visa-policy-site; build=fetch-wiki-visa-table)";

const MIN_DATA_ROWS = 120;

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/** 去掉 HTML 标签，合并空白 */
function stripTags(html) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 从第一个单元格取国家名与维基链接 */
function parseCountryCell(tdHtml) {
  const re = /<a[^>]*href="(\/wiki\/[^"#?]+)"[^>]*(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(tdHtml))) {
    const href = m[1];
    if (
      href.includes("/wiki/File:") ||
      href.includes("/wiki/Template:") ||
      href.includes("/wiki/Help:") ||
      href.includes("/wiki/Wikipedia:") ||
      href.includes("disambiguation")
    ) {
      continue;
    }
    const title = (m[2] && decodeEntities(m[2]).trim()) || stripTags(m[3]);
    if (!title || title.includes("edit") || title === "§") continue;
    const url = "https://en.wikipedia.org" + href.split("#")[0];
    const name = title.replace(/ \(.*\)$/, "").trim() || stripTags(m[3]);
    return { name, url };
  }
  return null;
}

function extractMainWikitable(html) {
  let idx = html.indexOf(">Visa requirement</th>");
  if (idx === -1) idx = html.indexOf("Visa requirement</th>");
  if (idx === -1) throw new Error("未在 HTML 中找到「Visa requirement」表头，维基页面结构可能已变更。");
  const tableStart = html.lastIndexOf("<table", idx);
  if (tableStart === -1) throw new Error("未找到签证主表 <table> 起始位置。");

  const lower = html.toLowerCase();
  let depth = 0;
  let i = tableStart;
  while (i < html.length) {
    const open = lower.indexOf("<table", i);
    const close = lower.indexOf("</table>", i);
    if (close === -1) throw new Error("未能找到闭合 </table>。");
    if (open !== -1 && open < close) {
      depth++;
      const gt = html.indexOf(">", open);
      i = gt === -1 ? open + 6 : gt + 1;
      continue;
    }
    depth--;
    i = close + 8;
    if (depth === 0) return html.slice(tableStart, i);
  }
  throw new Error("表格深度解析失败。");
}

function extractRows(tableHtml) {
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(tableHtml))) {
    const tr = m[1];
    if (/<th\b/i.test(tr)) continue;
    const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [];
    let tm;
    while ((tm = tdRe.exec(tr))) cells.push(tm[1]);
    if (cells.length < 2) continue;
    const country = parseCountryCell(cells[0]);
    if (!country) continue;
    const visaReq = stripTags(cells[1]);
    const stay = cells[2] ? stripTags(cells[2]) : "";
    if (!visaReq) continue;
    rows.push({ country, visaReq, stay });
  }
  return rows;
}

function toPipeTable(rows) {
  const header =
    "| Country / Region | Visa requirement | Allowed stay | Notes (excluding departure fees) | Rec­i­proc­i­ty |\n" +
    "| --- | --- | --- | --- | --- |\n";
  const lines = rows.map(
    (r) =>
      `| [${r.country.name}](${r.country.url}) | ${r.visaReq} | ${r.stay} |`,
  );
  return header + lines.join("\n") + "\n";
}

async function main() {
  let res;
  try {
    res = await fetch(API, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
  } catch (e) {
    throw new Error(`网络请求失败：${e && e.message ? e.message : String(e)}`);
  }
  if (!res.ok) throw new Error(`维基 API HTTP ${res.status}`);
  const json = await res.json();
  const html = json?.parse?.text;
  if (!html || typeof html !== "string") throw new Error("维基 API 返回无 parse.text");

  const tableHtml = extractMainWikitable(html);
  const rows = extractRows(tableHtml);
  if (rows.length < MIN_DATA_ROWS) {
    throw new Error(
      `解析到的国家行过少（${rows.length}），低于阈值 ${MIN_DATA_ROWS}，拒绝写入以免破坏数据。`,
    );
  }

  const output = toPipeTable(rows);
  fs.writeFileSync(outPath, output, "utf8");
  console.log("已写入", outPath, "数据行数：", rows.length);
}

main().catch((e) => {
  console.error(e.stack || e.message || e);
  process.exit(1);
});
