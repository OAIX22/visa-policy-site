/* global XLSX */
const STORAGE_KEY = "visa_policy_custom_v1";

/**
 * 内置国家库：`data/visa-seed.json`（约 190+ 目的地），由脚本根据维基百科签证表 + restcountries 国名/中文名生成，
 * 并对重点国家叠加领事口径摘要。Excel/CSV 导入同 `country_code` 会覆盖内置（见 mergedRecords）。
 */
let SEED_DATA = [];

/** 为常用目的地补充拼音/城市关键词，便于搜索（不改变已导入覆盖的政策正文） */
const SEARCH_ENRICH = {
  TH: { aliases: "泰,泰王国,taiguo,tg", cities_zh: "曼谷,清迈,普吉,芭提雅,Bangkok,Chiang Mai,Phuket" },
  JP: { aliases: "霓虹,riben,rw,dongjing", cities_zh: "东京,大阪,京都,名古屋,札幌,福冈,Tokyo,Osaka,Kyoto" },
  SG: { aliases: "星洲,xinjiapo,xjp", cities_zh: "新加坡,Singapore" },
  MY: { aliases: "大马,dama,malaixiya,mlxy", cities_zh: "吉隆坡,槟城,兰卡威,亚庇" },
  US: { aliases: "mei,meiguo,mg,纽约,niuyue", cities_zh: "纽约,洛杉矶,旧金山,西雅图,芝加哥,波士顿,华盛顿" },
  GB: { aliases: "ying,yingguo,london", cities_zh: "伦敦,曼彻斯特,爱丁堡,London" },
  VN: { aliases: "yuenan,yn", cities_zh: "河内,胡志明市,岘港,芽庄" },
  ID: { aliases: "印尼,yinni,巴厘岛,balidao", cities_zh: "雅加达,巴厘岛,泗水,Jakarta,Bali" },
  AE: { aliases: "迪拜,dibai,dubai,阿布扎比", cities_zh: "迪拜,阿布扎比,沙迦,Dubai" },
  TR: { aliases: "tu,tuerqi,istanbul,yist", cities_zh: "伊斯坦布尔,安卡拉,卡帕多奇亚,Istanbul" },
  KR: { aliases: "韩国,hanguo,hg,首尔,shouer", cities_zh: "首尔,釜山,济州,Seoul,Busan" },
  FR: { aliases: "法国,faguo,巴黎,bali", cities_zh: "巴黎,马赛,里昂,Paris" },
  DE: { aliases: "德国,deguo,柏林,bolin", cities_zh: "柏林,慕尼黑,法兰克福,Berlin,Munich" },
  IT: { aliases: "意大利,yidali,罗马,luoma", cities_zh: "罗马,米兰,威尼斯,Rome,Milan" },
  ES: { aliases: "西班牙,xibanya", cities_zh: "马德里,巴塞罗那,Madrid,Barcelona" },
  CA: { aliases: "加拿大,jianada", cities_zh: "多伦多,温哥华,蒙特利尔,Toronto,Vancouver" },
  AU: { aliases: "澳大利亚,aodaliya", cities_zh: "悉尼,墨尔本,布里斯班,Sydney,Melbourne" },
  NZ: { aliases: "新西兰,xinxilan", cities_zh: "奥克兰,惠灵顿,Auckland" },
  CH: { aliases: "瑞士,ruishi", cities_zh: "苏黎世,日内瓦,Zurich,Geneva" },
  NL: { aliases: "荷兰,helan", cities_zh: "阿姆斯特丹,鹿特丹,Amsterdam" },
  PT: { aliases: "葡萄牙,putaoya", cities_zh: "里斯本,波尔图,Lisbon" },
  GR: { aliases: "希腊,xila", cities_zh: "雅典,圣托里尼,Athens" },
  EG: { aliases: "埃及,aiji", cities_zh: "开罗,卢克索,Cairo" },
  ZA: { aliases: "南非,nanfei", cities_zh: "约翰内斯堡,开普敦" },
  BR: { aliases: "巴西,baxi", cities_zh: "圣保罗,里约热内卢" },
  AR: { aliases: "阿根廷,agenting", cities_zh: "布宜诺斯艾利斯,Buenos Aires" },
  MX: { aliases: "墨西哥,moxige", cities_zh: "墨西哥城,坎昆" },
  RU: { aliases: "俄罗斯,eluosi", cities_zh: "莫斯科,圣彼得堡,Moscow" },
};

async function loadSeed() {
  const url = new URL("data/visa-seed.json", window.location.href).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows.length) throw new Error("empty seed");
  for (const row of rows) {
    const code = String(row.country_code || "").toUpperCase();
    const ex = SEARCH_ENRICH[code];
    if (!ex) continue;
    if (ex.aliases) row.aliases = [row.aliases, ex.aliases].filter(Boolean).join(",");
    if (ex.cities_zh) row.cities_zh = [row.cities_zh, ex.cities_zh].filter(Boolean).join(",");
  }
  SEED_DATA = rows;
}

const TEMPLATE_CSV = `country_code,name_zh,name_en,aliases,cities_zh,policy_type,policy_summary,official_url,last_verified
TH,泰国,Thailand,"泰,泰王国,taiguo,tg","曼谷,清迈,普吉",落地签/电子签,"【示例】请替换为权威来源摘录。可含多行说明（导入时保留换行）。",https://www.mfa.go.th/,2026-05-06
`;

const REQUIRED_HEADERS = [
  "country_code",
  "name_zh",
  "name_en",
  "aliases",
  "cities_zh",
  "policy_type",
  "policy_summary",
  "official_url",
  "last_verified",
];

function $(sel) {
  return document.querySelector(sel);
}

function normalize(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function readCustom() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeCustom(rows) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
}

/** 先载入内置 SEED，再以 Excel/CSV 导入的 localStorage 记录按 country_code 完全覆盖同码条目 */
function mergedRecords() {
  const custom = readCustom();
  const map = new Map();
  for (const r of SEED_DATA) {
    map.set(String(r.country_code).toUpperCase(), { ...r, _source: "内置" });
  }
  for (const r of custom) {
    const code = String(r.country_code || "")
      .trim()
      .toUpperCase();
    if (!code) continue;
    map.set(code, {
      country_code: code,
      name_zh: String(r.name_zh || "").trim(),
      name_en: String(r.name_en || "").trim(),
      aliases: String(r.aliases || "").trim(),
      cities_zh: String(r.cities_zh || "").trim(),
      policy_type: String(r.policy_type || "").trim(),
      policy_summary: String(r.policy_summary || "").trim(),
      official_url: String(r.official_url || "").trim(),
      last_verified: String(r.last_verified || "").trim(),
      _source: "导入覆盖内置",
    });
  }
  return [...map.values()];
}

function splitList(s) {
  return String(s || "")
    .split(/[,，;；|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function scoreRecord(q, rec) {
  if (!q) return 0;
  const hay = [
    rec.country_code,
    rec.name_zh,
    rec.name_en,
    rec.aliases,
    rec.cities_zh,
    rec.policy_type,
  ]
    .join(" ")
    .toLowerCase();

  if (hay.includes(q)) {
    if (normalize(rec.name_zh) === q) return 120;
    if (normalize(rec.name_en).split(/[,，]/).some((p) => normalize(p) === q)) return 115;
    return 80 + Math.min(20, q.length);
  }

  const cityHits = splitList(rec.cities_zh).some((c) => normalize(c).includes(q) || q.includes(normalize(c)));
  if (cityHits) return 95;

  const aliasHits = splitList(rec.aliases).some((a) => normalize(a) === q || normalize(a).includes(q));
  if (aliasHits) return 90;

  const enParts = splitList(rec.name_en);
  if (enParts.some((p) => q.length >= 3 && normalize(p).includes(q))) return 70;

  return 0;
}

function search(q) {
  const query = normalize(q);
  const rows = mergedRecords();
  if (!query) return [];
  return rows
    .map((r) => ({ r, s: scoreRecord(query, r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderResults(list, emptyMode) {
  const el = $("#results");
  el.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    if (emptyMode === "idle") {
      empty.textContent =
        "在上方输入国家中文名、英文国名、拼音缩写或主要城市名，点击搜索即可查看对应签证政策摘要。";
    } else {
      empty.textContent =
        "未找到匹配项。可尝试英文国名、拼音缩写或城市名；也可通过 Excel / CSV 导入补充数据。";
    }
    el.appendChild(empty);
    return;
  }
  for (const rec of list) {
    const card = document.createElement("article");
    card.className = "card";
    const head = document.createElement("header");
    const h2 = document.createElement("h2");
    h2.textContent = rec.name_zh || rec.name_en || rec.country_code;
    head.appendChild(h2);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <span class="badge"><code>${esc(rec.country_code)}</code></span>
      ${rec.name_en ? `<span class="badge">${esc(rec.name_en)}</span>` : ""}
      ${rec.policy_type ? `<span class="badge badge--policy" title="签证要求">${esc(rec.policy_type)}</span>` : ""}
      ${rec._source ? `<span class="badge">${esc(rec._source)}</span>` : ""}
    `;
    head.appendChild(meta);
    card.appendChild(head);

    const p = document.createElement("p");
    p.className = "summary";
    p.textContent = rec.policy_summary || "（暂无摘要）";
    card.appendChild(p);

    if (rec.official_url) {
      const a = document.createElement("a");
      a.href = rec.official_url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "官方参考链接";
      a.style.display = "inline-block";
      a.style.marginTop = "14px";
      card.appendChild(a);
    }
    if (rec.last_verified) {
      const d = document.createElement("p");
      d.style.marginTop = "10px";
      d.style.fontSize = "12px";
      d.style.color = "var(--text-tertiary)";
      d.textContent = `人工核验 / 标注日期：${rec.last_verified}`;
      card.appendChild(d);
    }
    el.appendChild(card);
  }
}

function showMsg(text) {
  const m = $("#msg");
  if (!text) {
    m.hidden = true;
    m.textContent = "";
    return;
  }
  m.hidden = false;
  m.textContent = text;
}

function normalizeRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const kk = String(k).trim().toLowerCase();
    out[kk] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}

function validateImported(rows) {
  const errors = [];
  if (!rows.length) errors.push("文件中没有数据行。");
  const cleaned = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = normalizeRowKeys(rows[i]);
    const code = String(raw.country_code || "")
      .trim()
      .toUpperCase();
    const nameZh = String(raw.name_zh || "").trim();
    const summary = String(raw.policy_summary || "").trim();
    if (!code || code.length !== 2) {
      errors.push(`第 ${i + 2} 行：country_code 必须为 2 位字母（当前：${raw.country_code || "空"}）。`);
      continue;
    }
    if (!/^[A-Z]{2}$/.test(code)) {
      errors.push(`第 ${i + 2} 行：country_code 格式无效（${code}）。`);
      continue;
    }
    if (!nameZh) {
      errors.push(`第 ${i + 2} 行：name_zh 不能为空。`);
      continue;
    }
    if (!summary) {
      errors.push(`第 ${i + 2} 行：policy_summary 不能为空。`);
      continue;
    }
    cleaned.push({
      country_code: code,
      name_zh: nameZh,
      name_en: String(raw.name_en || "").trim(),
      aliases: String(raw.aliases || "").trim(),
      cities_zh: String(raw.cities_zh || "").trim(),
      policy_type: String(raw.policy_type || "").trim(),
      policy_summary: summary,
      official_url: String(raw.official_url || "").trim(),
      last_verified: String(raw.last_verified || "").trim(),
    });
  }
  return { cleaned, errors };
}

function mergeImported(cleaned) {
  const map = new Map();
  for (const r of readCustom()) {
    const c = String(r.country_code || "")
      .trim()
      .toUpperCase();
    if (c) map.set(c, r);
  }
  for (const r of cleaned) {
    map.set(r.country_code, r);
  }
  writeCustom([...map.values()]);
}

function parseSpreadsheetBuffer(ab, nameLower) {
  if (!globalThis.XLSX) throw new Error("表格解析库未加载，请检查网络后重试。");
  let wb;
  if (nameLower.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(ab);
    wb = XLSX.read(text, { type: "string" });
  } else {
    wb = XLSX.read(ab, { type: "array" });
  }
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return rows;
}

function assertHeaders(sampleRow) {
  const keys = Object.keys(normalizeRowKeys(sampleRow));
  const missing = REQUIRED_HEADERS.filter((h) => !keys.includes(h));
  if (missing.length) {
    throw new Error(`表头缺少列：${missing.join(", ")}。请下载模板对照修改（列名不区分大小写）。`);
  }
}

async function onImportFile(file) {
  const status = $("#upload-status");
  status.textContent = "正在解析…";
  showMsg("");
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();
  const rows = parseSpreadsheetBuffer(buf, name);
  if (!rows.length) {
    status.textContent = "未解析到任何行。";
    return;
  }
  assertHeaders(rows[0]);
  const { cleaned, errors } = validateImported(rows);
  if (errors.length) {
    status.textContent = `已中止导入。${errors.slice(0, 6).join(" ")}${errors.length > 6 ? " …" : ""}`;
    showMsg(errors[0]);
    return;
  }
  if (!cleaned.length) {
    status.textContent = "没有可导入的有效数据行。";
    return;
  }
  mergeImported(cleaned);
  status.textContent = `成功导入 ${cleaned.length} 条（按 country_code 合并至本机库）。`;
  const dlg = $("#dlg-upload");
  if (dlg && "open" in dlg && dlg.open) dlg.close();
  const q = $("#q").value;
  const hits = search(q);
  if (!normalize(q)) renderResults([], "idle");
  else renderResults(hits, hits.length ? undefined : "nohits");
}

function downloadBlob(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function wire() {
  $("#search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#q").value;
    showMsg("");
    if (!normalize(q)) {
      renderResults([], "idle");
      showMsg("请输入国家、城市或拼音关键词。");
      return;
    }
    const list = search(q);
    renderResults(list, list.length ? undefined : "nohits");
  });

  $("#btn-download-template").addEventListener("click", () => {
    downloadBlob("visa-policy-template.csv", "text/csv;charset=utf-8", TEMPLATE_CSV);
  });

  $("#btn-open-upload").addEventListener("click", () => {
    $("#upload-status").textContent = "";
    $("#file-import").value = "";
    const dlg = $("#dlg-upload");
    if (dlg && typeof dlg.showModal === "function") dlg.showModal();
  });

  $("#dlg-upload").addEventListener("click", (e) => {
    if (!e.target.matches("[data-close]")) return;
    const dlg = $("#dlg-upload");
    if (dlg && typeof dlg.close === "function") dlg.close();
  });

  $("#file-import").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onImportFile(file);
    } catch (err) {
      $("#upload-status").textContent = String(err.message || err);
      showMsg(String(err.message || err));
    }
  });

  $("#btn-export-custom").addEventListener("click", () => {
    const data = readCustom();
    downloadBlob(
      "visa-policy-custom.json",
      "application/json;charset=utf-8",
      JSON.stringify(data, null, 2),
    );
  });

  $("#btn-clear-custom").addEventListener("click", () => {
    if (!confirm("确定清空本浏览器保存的所有自定义导入数据？")) return;
    localStorage.removeItem(STORAGE_KEY);
    showMsg("已清空本机自定义数据。");
    const q = $("#q").value;
    const hits = search(q);
    if (!normalize(q)) renderResults([], "idle");
    else renderResults(hits, hits.length ? undefined : "nohits");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadSeed();
  } catch (err) {
    showMsg(
      "内置国家库加载失败（若用 file:// 打开页面，请改用本地 HTTP 服务，例如：npx serve）。详情：" +
        (err && err.message ? err.message : String(err)),
    );
  }
  wire();
  renderResults([], "idle");
});
