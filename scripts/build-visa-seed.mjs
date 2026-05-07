/**
 * 从 data/wiki-visa-table.txt + data/restcountries.json 生成 data/visa-seed.json
 * 运行：node scripts/build-visa-seed.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");

const WIKI_REF =
  "综合参考：英文维基百科条目 Visa requirements for Chinese citizens（对中国普通护照，表格中的 Visa requirement / Allowed stay）；出行条件请以中华人民共和国外交部领事司「中国领事服务网」及目的地主管机关最新公布为准。";

/** 维基表中国家/地区英文名 → ISO 3166-1 alpha-2（自动匹配失败时使用） */
const NAME_TO_CODE = {
  "United Kingdom and Crown dependencies": "GB",
  "Democratic Republic of the Congo": "CD",
  "Republic of the Congo": "CG",
  "Czech Republic": "CZ",
  "Côte d'Ivoire": "CI",
  "South Korea": "KR",
  "North Korea": "KP",
  "Timor-Leste": "TL",
  Micronesia: "FM",
  "Republic of Ireland": "IE",
  "The Bahamas": "BS",
  Bahamas: "BS",
  "The Gambia": "GM",
  Gambia: "GM",
  "São Tomé and Príncipe": "ST",
  "East Timor": "TL",
  "Cape Verde": "CV",
  Eswatini: "SZ",
  "Vatican City": "VA",
  "North Macedonia": "MK",
  "Marshall Islands": "MH",
  "Solomon Islands": "SB",
  "Papua New Guinea": "PG",
  "Sierra Leone": "SL",
  "Sri Lanka": "LK",
  "Costa Rica": "CR",
  "Dominican Republic": "DO",
  "El Salvador": "SV",
  "Equatorial Guinea": "GQ",
  "South Sudan": "SS",
  "Trinidad and Tobago": "TT",
  "Burkina Faso": "BF",
  "Brunei": "BN",
  "Laos": "LA",
  Russia: "RU",
  Türkiye: "TR",
};

/** 对若干国家使用更贴近领事口径的摘要（覆盖维基表行） */
const OVERRIDES = {
  TH: {
    policy_type: "互免签证（短期停留）",
    policy_summary:
      "《中华人民共和国政府与泰王国政府关于互免持普通护照人员签证协定》已生效。协定框架下，双方持普通护照人员可免签进入对方国家，单次停留与「每 180 日累计停留」均有上限；从事工作、学习、新闻报道、定居等须事先批准的活动或拟停留超过协定允许期限的，须事先办妥相应签证。\n泰方曾对短期免签「单次可停留天数」作过延长安排；是否须事先在线填报入境卡（如 TDAC）等以泰方最新规定为准。\n出行前请查阅中国领事服务网泰国国别页、中国驻泰国使领馆及泰国移民局。",
    official_url: "https://cs.mfa.gov.cn/zggmcg/ljmdd/yz_645708/tg_647570/",
  },
  JP: {
    policy_type: "需事先办签（短期旅游）",
    policy_summary:
      "持中国大陆普通护照以旅游等短期停留为目的赴日，须事先向日本驻华使领馆指定的旅行社申请并取得相应签证（个人旅游、团队旅游及各类多次签证等条件、停留期以使馆公布为准）。\n请以日本国驻华大使馆网站「签证」栏目及外务省说明为准。",
    official_url: "https://www.cn.emb-japan.go.jp/itpr_zh/visa_kanko.html",
  },
  SG: {
    policy_type: "互免签证（30 日）",
    policy_summary:
      "根据新加坡移民与关卡局（ICA）公布，自 2024 年 2 月 9 日起，中华人民共和国护照（普通护照）持有人可免签进入新加坡从事旅游、探亲、商务等私人事务，停留不超过 30 日；停留更长或从事须批准的活动须另行办妥签证。\n请以 ICA 及驻华使馆最新公告为准。",
    official_url: "https://www.ica.gov.sg/",
  },
  MY: {
    policy_type: "互免签证（30 日 / 180 日累计限制）",
    policy_summary:
      "《中华人民共和国政府和马来西亚政府关于互免持公务普通护照和普通护照人员签证的协定》已生效。持中国普通护照以旅游、商务、探亲等为目的入境马来西亚，一般可免办签证，单次停留不超过 30 日，且「每 180 日内在马累计停留」不超过 90 日；拟停留更久或从事工作、学习等须事先办妥相应签证。\n入境前在线填报马来西亚数字入境卡（MDAC）等要求以中国驻马来西亚使馆及马移民局最新提示为准。",
    official_url: "https://cs.mfa.gov.cn/zggmcg/ljmdd/yz_645708/mlxy_647012/",
  },
  US: {
    policy_type: "需事先办签（B1/B2 等）",
    policy_summary:
      "持中国普通护照赴美旅游、商务或探亲等，一般须事先向美国驻华使领馆申请并获得相应类别的非移民签证（常见为 B-1/B-2）。获发十年 B1/B2 签证且计划以该签证入境的，通常还须按美方要求完成 EVUS 登记（是否适用以美方系统为准）。\n请以美国国务院、驻华使领馆及签证申请服务中心最新指引为准。",
    official_url: "https://www.ustraveldocs.com/cn_zh/",
  },
  GB: {
    policy_type: "需事先办签（Standard Visitor）",
    policy_summary:
      "持中国普通护照以旅游、探亲或短期商务等为目的入境英国，一般须事先在线申请并获得 Standard Visitor visa（或相应类别签证）。\n请以英国政府 GOV.UK 签证与移民局说明为准。",
    official_url: "https://www.gov.uk/standard-visitor/apply-standard-visitor-visa",
  },
  VN: {
    policy_type: "需事先办签（常用：电子签证 e-Visa）",
    policy_summary:
      "持中国普通护照赴越南，须事先办妥越南主管机关颁发的签证或入境许可；实务中较多使用越南公安部出入境管理局开放的电子签证（e-Visa）。\n请以越南电子签证官方门户及驻华使领馆为准。",
    official_url: "https://evisa.xuatnhapcanh.gov.vn/",
  },
  ID: {
    policy_type: "落地签（VOA）/电子落地签（e-VOA）等",
    policy_summary:
      "持中国普通护照以旅游等短期访问为目的入境印尼，一般可在符合印尼法律的前提下在口岸办理落地签证（VOA）或事先在线申请电子落地签（e-VOA）等；停留期限、费用与可入境口岸以印尼法律及移民局当日执行为准。\n请以印尼移民局及中国驻印尼使领馆发布为准。",
    official_url: "https://www.imigrasi.go.id/en/",
  },
  AE: {
    policy_type: "免签入境（停留期限以阿方执行为准）",
    policy_summary:
      "阿联酋对中国普通护照持有人实行单方面免签入境安排，入境后可停留的期限由阿方依法决定并可能调整。入境一般须持有效期不少于 6 个月的护照，并建议备妥返程或续程机票、酒店订单及与停留相符的资金证明。\n请以阿联酋联邦政府官方平台及中国驻阿联酋使领馆最新领事提醒为准。",
    official_url:
      "https://u.ae/en/information-and-services/visa-and-emirates-id/entry-and-residence-procedures/short-term-visits",
  },
  TR: {
    policy_type: "电子签证（e-Visa）/使领馆签证",
    policy_summary:
      "持中国普通护照以旅游或商务为目的短期赴土耳其，常见做法为通过土耳其电子签证系统在线申办 e-Visa；系统将根据护照种类、旅行证件等自动判断是否具备在线申办资格及获准的停留期限。不符合电子签条件或拟长期停留、工作、学习等，须在土耳其驻华外交机构申办相应签证。\n请以 e-Visa 官网及土耳其外交部说明为准。",
    official_url: "https://www.evisa.gov.tr/zh/",
  },
};

function stripMdLink(s) {
  return String(s || "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function visaReqToZhType(req) {
  const r = stripMdLink(req).toLowerCase();
  if (r.includes("visa not required")) return "免签（或视同免签入境，以边检执行为准）";
  if (r.includes("free evisa") || r.includes("free eta")) return "免费电子签 / 免费 ETA 等";
  if (r.includes("electronic travel authorisation") || r.includes("electronic travel authorization"))
    return "电子旅行许可（ETA/eTA 等）";
  if (r.includes("evisa") && r.includes("visa on arrival")) return "电子签与落地签并存（以口岸为准）";
  if (r.includes("e-visa") || r.includes("evisa") || r.includes("e visa")) return "电子签证（eVisa 等）";
  if (r.includes("online visa")) return "在线签证（须事先获准）";
  if (r.includes("visa on arrival")) return "落地签（口岸缴费/填表，以当地为准）";
  if (r.includes("visa required")) return "需事先办签（贴纸/另纸签等）";
  return "以目的地归类为准（请查官方）";
}

function buildNameIndex(countries) {
  const byNorm = new Map();
  for (const c of countries) {
    const code = c.cca2;
    const names = new Set();
    const add = (n) => {
      if (!n) return;
      names.add(n);
      byNorm.set(norm(n), code);
    };
    add(c.name?.common);
    add(c.name?.official);
    if (c.altSpellings) c.altSpellings.forEach(add);
    if (c.translations?.zho?.common) add(c.translations.zho.common);
    if (c.translations?.zho?.official) add(c.translations.zho.official);
  }
  return byNorm;
}

function resolveCode(wikiName, byNorm) {
  if (NAME_TO_CODE[wikiName]) return NAME_TO_CODE[wikiName];
  let code = byNorm.get(norm(wikiName));
  if (code) return code;
  const stripped = wikiName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  code = byNorm.get(norm(stripped));
  return code || null;
}

function parseWikiRows(text) {
  const rows = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("| [")) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 4) continue;
    const m = parts[1].match(/^\[([^\]]+)\]/);
    if (!m) continue;
    const countryName = m[1];
    const visaReq = stripMdLink(parts[2]);
    const stay = stripMdLink(parts[3] || "");
    rows.push({ countryName, visaReq, stay });
  }
  return rows;
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const countries = JSON.parse(fs.readFileSync(path.join(dataDir, "restcountries.json"), "utf8"));
  const byNorm = buildNameIndex(countries);
  const metaByCode = new Map();
  for (const c of countries) {
    metaByCode.set(c.cca2, c);
  }

  const wikiText = fs.readFileSync(path.join(dataDir, "wiki-visa-table.txt"), "utf8");
  const wikiRows = parseWikiRows(wikiText);
  const out = [];
  const missing = [];

  for (const { countryName, visaReq, stay } of wikiRows) {
    const code = resolveCode(countryName, byNorm);
    if (!code) {
      missing.push(countryName);
      continue;
    }
    const meta = metaByCode.get(code);
    const nameEn = meta?.name?.common || countryName;
    const nameZh = meta?.translations?.zho?.common || meta?.translations?.zho?.official || nameEn;
    const zhType = visaReqToZhType(visaReq);
    const stayLine = stay ? `公开资料表列参考停留：${stay}（入境时可能被裁量缩短）。` : "";

    let rec = {
      country_code: code,
      name_zh: nameZh,
      name_en: nameEn,
      aliases: "",
      cities_zh: "",
      policy_type: zhType,
      policy_summary: `对中国大陆普通护照，目的地侧通行要求多归纳为「${zhType}」。${stayLine}\n${WIKI_REF}`,
      official_url: "https://cs.mfa.gov.cn/",
      last_verified: today,
    };

    if (OVERRIDES[code]) {
      rec = { ...rec, ...OVERRIDES[code], last_verified: OVERRIDES[code].last_verified ?? today };
    }
    out.push(rec);
  }

  if (missing.length) {
    console.error("未匹配 ISO 的国家：", missing);
    process.exit(1);
  }

  out.sort((a, b) => a.country_code.localeCompare(b.country_code));
  fs.writeFileSync(path.join(dataDir, "visa-seed.json"), JSON.stringify(out, null, 0), "utf8");
  console.log("写入 visa-seed.json，条数：", out.length);
}

main();
