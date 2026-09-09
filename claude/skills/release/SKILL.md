---
name: "release"
description: "打 tag 发布版本：读取版本号与 CHANGELOG，打带注释的 git tag、推送到远程、创建 GitHub Release（含 Release notes 与构建产物如 vsix）。当用户输入 release / 打tag发布 / 发版 时触发。用户主动触发即授权完整流程（git tag -a + git push tag + gh release create），标准情况无需逐次确认；遇 tag 已存在等异常暂停询问；发布成功后删除本次构建的本地产物。"
---

# Auto Tag & GitHub Release

当用户输入 `release`（或「打 tag 发布」「发版」）时，读取当前项目版本号与 CHANGELOG，**依次执行 `git tag -a` → `git push origin <tag>` → `gh release create`**，打带注释的 git tag、推送到远程、创建 GitHub Release（含 Release notes，并尝试附加构建产物如 vsix）。

## 授权语义（对应「下次不问」）

- 用户主动输入 `/release` 即**明确授权**当次的 `git tag -a` + `git push origin <tag>` + `gh release create`，**直接执行完整流程，无需逐次列命令等确认**。与 `/commit` 同属「用户主动触发的 git 写操作类 skill」，不适用全局「git 写操作逐次确认」规则——用户发 `/release` 就是要一键发布，再问一遍是多余的反 confirm。
- **例外**：下列异常情况**必须暂停询问**用户后再继续（这不属于「标准流程的确认」，而是异常安全阀）：
  - 该 tag **本地或远程已存在**（尤其指向非 HEAD 的错误 commit 时——需用户确认是否 force push 修正，绝不自行 force push）；
  - 工作区有**未提交改动**（需用户确认先 commit 还是中止）；
  - CHANGELOG 中**找不到该版本条目**（需用户确认 notes 来源）；
  - GitHub **已有同名 Release**（需用户确认编辑还是保持不动）；
  - 版本号异常（如低于当前最新 tag）。

## 核心定位：一次完成「打 tag + 推送 + 发 Release」

- 本 skill **依次执行 `git tag -a`、`git push origin <tag>`、`gh release create`**：先打 annotated tag，再推送，最后创建 Release。
- tag 必为 **annotated**（`-a`，带注释），message 取自 CHANGELOG；**不用 lightweight tag**。
- Release notes 取自 CHANGELOG 对应版本条目。
- **不 commit、不改动工作区文件**：假定版本号、CHANGELOG、构建产物已就绪。工作区脏则暂停（commit 是 `/commit` 的职责）。
- **严禁** `git push --force`、`git tag -d` 删除远程 tag、删除已发布 Release，**除非**用户在异常分支明确同意。
- **严禁**编辑、删除、格式化项目文件，不改动 `.gitignore`。

## 发布语言：GitHub Release 内容统一全英文

- 发布到 GitHub Release 的**对外可见内容**一律使用**全英文**，不用中文或中英混排。具体包括：Release **title**、Release **notes**、annotated **tag 的 message**。
- **理由**：Release 是面向全球开发者的公开产物，全英文保证最广可读性，也与英文项目 description、topics 的风格一致。
- **CHANGELOG 是中文时需翻译**：CHANGELOG 该版本条目若含中文（或中英混排），先**逐条翻译成地道英文**，再用于 tag message 与 Release title / notes。
  - **翻译后即用、不回写 CHANGELOG 源文件**——本 skill 严禁编辑项目文件，CHANGELOG 保持项目原有语言不动。
- **翻译要求**：用规范、地道的通用英文技术表述；版本号、文件名、命令、代码片段等专有 token 原样保留；逐条对照不漏条目、不自造缩写。标题用简洁概述（如 `Add resource cleanup whitelist`），正文用条目列表。
- **异常分支的手写 notes 同样用英文**：若 CHANGELOG 找不到条目而由用户手写或给简短描述，仍以英文写入 Release；`--generate-notes` 自动生成的 notes 本身即英文，可直接使用。
- **构建产物文件名不强制改**：文件名一般已是英文 / 版本号（如 `xxx-0.2.2.vsix`），无需为语言要求重命名。

## Release 标题：统一「项目名 + 版本号」格式（2026-09-06 用户立）

- GitHub Release 的 **title 一律用「`<项目名> <版本号>`」格式**（如 `zcode-cli 3.8.1-27`），**不用长描述句**。项目名取仓库目录名（`basename`，与 package.json `name` 不一致时以目录名为准）。
- **为什么**：Release 列表页只显示 title，「项目名 + 版本号」能一眼对出版本；描述句作 title 会在列表里被截断成冗长的省略行，既难扫读也不像版本（2026-09-06 用户纠偏：zcode-cli 的 v3.8.1-22 ~ -27 曾用描述句当 title，属偏离，早期 v3.8.1-21 及以前才是「项目名 + 版本号」的正确格式）。
- CHANGELOG 该版本条目的**概述句（第一行标题 / 概述）翻译成英文后，只作为 Release notes 与 annotated tag message 的正文首行**，不作 Release title——信息不丢，列表显示归格式。
- **历史 Release 已是描述句标题的**：发现时列出清单，提示用户是否统一回改为「项目名 + 版本号」（`gh release edit <tag> --title "<项目名> <版本号>"`），经用户同意后执行，不擅自批量改。

## 安装链接：固定 tag 形式，禁用 latest/download（2026-09-08 用户立）

- Release notes、README 等处给出的**安装链接（npm/bun install 指向 Release asset 的 URL 等）一律用固定 tag 形式**：`https://github.com/<owner>/<repo>/releases/download/<tag>/<asset>`（如 `.../releases/download/v3.8.1-32/zcode-cli-3.8.1-32.tgz`）。
- **禁止** `https://github.com/<owner>/<repo>/releases/latest/download/<asset>` 形式（含翻译 / 改写 notes 时顺手带出的存量链接——遇到即改为固定 tag 形式）。
- **为什么**：`latest/download` 永远指向**当前最新** Release 的同名 asset，而 asset 文件名通常带版本号——下一个版本发布后，历史文档里的该链接必然 404（zcode-cli 曾以「发版前预对齐版本号」勉强维持，历史上两轮忘记执行导致 README 链接长期 404；2026-09-08 用户裁定弃用）。固定 tag URL 永指该版本 asset，历史链接永不失效。
- **README 里的存量 latest 链接**：发布涉及的项目 README 若仍用 latest/download 形式，**发现即在汇报中列出、建议随下次 bump / commit 改为固定 tag 形式**——本 skill 仍不编辑项目文件（发布要求工作区干净，中途改文件破坏发布原子性）。

## 执行流程

0. **对齐 remote main（2026-09-06 新工作流，最前置）**：正式发布发布的就是 main 分支的内容——
   - `git switch main && git fetch origin && git pull --ff-only`；
   - 校验 `HEAD === origin/main`：落后（bump 直推未完成 / 功能 PR 还没合并）→ **暂停**，提示先完成对应提交（bump 走 `/commit` 直推 main；功能分支等 PR 合并，`gh pr list` 查看未合并 PR）后再 `/release`；本地与远端分叉 → **暂停**报告，等用户确认对齐方式；
   - 校验版本就绪：`VERSION`（或版本源文件）与 CHANGELOG 顶部条目版本号一致——不一致说明尚未 bump → **暂停**，提示先执行 `/bump`（三段式发版：/bump → /commit 直推 → /release）；
   - 本 skill **不 push main 分支**：tag 推送（`git push origin <tag>`）只推 tag 引用、不碰分支更新，不携带本地 main 的未推送提交。
1. **确定版本号与 tag 名**
   - 依次探测版本来源（取第一个命中的）：`package.json` 的 `version` 字段 → `VERSION` 文件 → `pyproject.toml` 的 `version` → `Cargo.toml` 的 `version`。
   - 规范化 tag 名：若版本号不以 `v` 开头则加 `v` 前缀（如 `0.2.2` → `v0.2.2`）；若已是 `v0.2.2` 则保留。下文记为 `<tag>`。
   - 目标 commit 默认为 `HEAD`。

2. **检查工作区**
   - `git status --porcelain`：若有任何未提交改动 → **暂停**，列出改动清单，提示用户先 `/commit` 或明确指示后再继续。
   - 工作区干净 → 继续。

3. **检查 tag 是否已存在（本地 + 远程）**
   - `git tag -l '<tag>'`（本地）、`git ls-remote --tags origin '<tag>'`（远程）。
   - **都不存在** → 进入标准流程（第 4 步起）。
   - **已存在**（本地或远程）→ **暂停**，报告：
     - 该 tag 本地 / 远程分别指向的 commit；
     - 与 HEAD 的关系（一致 / 落后 / 领先几个 commit）；
     - tag 类型（annotated / lightweight，远程用 `gh api repos/<owner>/<repo>/git/refs/tags/<tag>` 与 `git/tags/<sha>` 确认解引用到的 commit）；
     - GitHub 是否已有对应 Release（`gh release view <tag>`）。
     并给出处理选项（force push 修正指向 / 补发或更新 Release / 保持现状），等用户选择。**不自行 force push 或删除。**

4. **读取 CHANGELOG 该版本条目**
   - 在 `CHANGELOG.md`（或 `CHANGES.md` / `HISTORY.md` 等）中定位 `## [<version>]` 或 `## [<tag>]` 段落，提取到下一个 `## [` 之前的内容。
   - 第一行（标题 / 概述）与其余内容分别用作 **notes 正文首行**与 **body / notes**——概述句不作 Release title，title 按「Release 标题」一节取「`<项目名> <版本号>`」格式。
   - **语言**：条目若含中文（或中英混排），按上方「发布语言：GitHub Release 内容统一全英文」一节**翻译成地道英文**后再用于 notes（翻译后即用、不回写源文件）；后续 tag message、Release notes 均以此英文版本为准。
   - 找不到 CHANGELOG 或该版本条目 → **暂停**，问用户 notes 来源（手写 / `--generate-notes` 自动生成 / 简短描述）。

5. **打 annotated tag**
   - `git tag -a <tag> -m "<notes 首行>" -m "<body>"`（notes 首行 = 概述句英译，与 body 分两个 `-m`；body 多行直接用换行）。
   - message 末尾**不加** `Co-Authored-By`（tag 非提交，无需署名）。

6. **推送 tag**
   - `git push origin <tag>`。
   - 若被拒（远程已存在）→ 回到第 3 步异常处理（**不自行 `--force`**）。

7. **创建 GitHub Release**
   - 先 `gh release view <tag>` 确认是否已有 Release：
     - 无 → `gh release create <tag> --title "<项目名> <版本号>" --notes "<notes>"`（title 格式见「Release 标题」一节）。
     - 已有 → **暂停**，问用户是否编辑（`gh release edit`）或保持不动。
   - **构建产物上传**：探测常见产物路径（`*.vsix`、`dist/*`、`build/*`、`target/*.zip` 等）。若有，作为 asset 附加：`gh release create <tag> ... <asset-paths>` 或 `gh release upload <tag> <asset-paths>`。
     - 若产物需先构建（如 `npm run package` 生成 vsix），**暂停**提示用户先构建，或征得同意后执行构建命令再上传。
   - Release notes 优先用 CHANGELOG 内容（`--notes "<notes>"`）；若内容很长，写入临时文件用 `--notes-file <file>`（临时文件放项目 `tmp/` 目录，用后清理；确保 `tmp/` 已在 `.gitignore`）。

8. **验证**
   - `git ls-remote --tags origin '<tag>'` 确认远程 tag 已就位；若需确认 annotated tag 解引用到 HEAD，用 `gh api repos/<owner>/<repo>/git/refs/tags/<tag>` 查 `object.type` 为 `tag` 且解引用 commit = HEAD。
   - `gh release view <tag>` 确认 Release 已发布、asset 已上传、notes 正确。

9. **清理本地构建产物**
   - 发布**成功并验证通过**（第 8 步）后，删除本次为发布构建的可分发产物文件——即作为 Release asset 上传的那些（如 `*.vsix`、打包的 zip / tar、可执行包等）。产物已归档到 Release，本地无需保留，删除以保持工作区整洁、避免版本堆积。
   - **只删本次构建产生的可分发产物文件**；不删开发期编译中间输出（`dist/`、`out/`、`build/` 等中间目录——下次开发还要用，且通常已在 `.gitignore`），不删源码、不删正式 `assets/` 里的图标 / logo 源文件。
   - 构建产物属发布流程产生的临时文件，删除不违反「严禁删除项目文件」（该禁令针对源码、配置等项目主体）。
   - **仅发布成功后才删**：若中途异常暂停（tag 已存在、Release 已存在、上传失败等），**保留产物**不删（可能还需重试上传）。
   - 历史遗留的旧版本产物（如之前版本残存的 `*.vsix`）一并提示用户是否清理。

## 注意

- 本 skill 一次性完成「打 tag + 推送 + 发 Release」；不负责 commit 工作区改动（那是 `/commit` 的职责）。
- tag 必为 annotated（`-a`），message 取自 CHANGELOG；不用 lightweight tag。
- GitHub Release 对外内容（Release title / notes、tag message）统一全英文；CHANGELOG 是中文时翻译后使用，不回写源文件。
- Release title 统一「`<项目名> <版本号>`」格式（如 `zcode-cli 3.8.1-27`）；概述句只作 notes / tag message 正文首行，不作 title。
- 遇 tag 已存在、工作区脏、CHANGELOG 缺条目、Release 已存在等异常，**暂停询问**，不自行 force push / 删除 / 覆盖。
- 构建产物上传前确认产物存在；需构建时先暂停征得同意。
- 临时 notes 文件放 `tmp/` 并清理，不污染项目。
- 发布成功后删除本次构建的可分发产物（vsix / 压缩包 / 可执行包等），不删中间编译输出（`dist/`、`out/`、`build/`）与正式 `assets/`；异常暂停时保留产物。
- 推送或 Release 创建失败如实报告，不自行破坏性重试。

## 汇报

报告发布结果：版本号、tag 名、tag 指向的 commit（= HEAD）、推送是否成功、GitHub Release URL、Release title、上传的 asset 清单（若有）、已清理的本地构建产物（若有）；若因异常暂停，则列出异常详情与可选项。
