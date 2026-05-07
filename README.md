# 中国大陆居民出境签证政策查询（演示站点）

## 使用方式

**须用本地静态服务器打开**（内置国家库为 `data/visa-seed.json`，需通过 HTTP 加载；`file://` 会加载失败）：

```bash
cd visa-policy-site
npx --yes serve .
```

浏览器访问终端里提示的地址。

## 内置数据说明

- 文件：`data/visa-seed.json`（约 190+ 条），由 `scripts/build-visa-seed.mjs` 根据 `data/wiki-visa-table.txt`（摘录自英文维基百科 **Visa requirements for Chinese citizens** 表格）与 `data/restcountries.json`（国名/中文名）生成。  
- 对中、泰、新、马、美、英、越、印尼、阿联酋、土等国的摘要，脚本内另有领事口径覆盖层。  
- **重新生成**：`node scripts/build-visa-seed.mjs`（需上述两个数据文件均在 `data/` 下）。

说明：维基表为**国别全覆盖**（与「同中国有客运航班往来的国家集合」在常用旅行线上高度重合，但并非按航司时刻表逐条校验）。若产品上要严格按「当前通航」筛选，可后续对接航班/航路数据再过滤 `country_code`。

## GitHub Actions 定时更新

仓库已包含 `.github/workflows/regenerate-visa-seed.yml`：

- **触发**：每天 **01:00 UTC**（约北京时间 **09:00**）自动执行；也可在 Actions 里 **Run workflow** 手动触发。  
- **行为（与之前「维基表 + OVERRIDES」一致）**  
  1. `node scripts/fetch-wiki-visa-table.mjs`：通过 **MediaWiki API** 拉取英文维基 [Visa requirements for Chinese citizens](https://en.wikipedia.org/wiki/Visa_requirements_for_Chinese_citizens) 页面 HTML，解析主 `wikitable`，覆盖写入 `data/wiki-visa-table.txt`（须合规 **User-Agent**，见脚本内说明）。  
  2. `node scripts/build-visa-seed.mjs`：用 `wiki-visa-table.txt` + `data/restcountries.json` 生成 `data/visa-seed.json`，并对脚本内 **OVERRIDES**（领事口径重点国）按 `country_code` 覆盖对应条目。  
  3. 若 `wiki-visa-table.txt` 或 `visa-seed.json` 有变更，由 `github-actions[bot]` **commit + push** 到默认分支。  
- **失败保护**：若维基 HTML 结构变化导致解析到的国家行 **少于 120 条**，fetch 脚本会 **退出失败且不覆盖** 原 `wiki-visa-table.txt`，避免清空数据。  
- **仓库结构**：工作流假定 **Git 仓库根目录即本站点根目录**（与 `index.html`、`scripts/` 同级）。若本站放在 monorepo 子目录，请自行把 workflow 改为对应 `working-directory`。

启用前请在 GitHub：**Settings → Actions → General**，确认允许 Actions，且 **Workflow permissions** 勾选 **Read and write**（以便 bot 能 `git push`）。

**本地手动拉维基 + 生成**：`node scripts/fetch-wiki-visa-table.mjs && node scripts/build-visa-seed.mjs`

## Excel 数据模板

- 列定义、必填项与填写说明：`template/签证政策导入模板说明.md`  
- 也可在页面点击 **「下载 Excel 模板（CSV）」**，用 Microsoft Excel / WPS 打开后另存为 **`.xlsx`** 再批量维护。

导入的条目写入浏览器 **localStorage**。展示时先载入内置国家库，再按 `country_code` 叠加导入数据：**相同 ISO 二位码时，一律以 Excel/CSV 导入内容为准**，从而覆盖该国的内置摘要；同码多次导入则以最后一次为准。

## 免责声明

本站展示内容为信息整理与演示用途，**不构成任何法律或签证意见**。请以目的地国家/地区主管机关及驻华使领馆最新公布为准。
