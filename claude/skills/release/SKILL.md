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

## 执行流程

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
   - 第一行（标题 / 概述）作为 tag 与 Release 的 **title**；其余作为 **body / notes**。
   - **语言**：条目若含中文（或中英混排），按上方「发布语言：GitHub Release 内容统一全英文」一节**翻译成地道英文**后再用于 title / body（翻译后即用、不回写源文件）；后续 tag message、Release title / notes 均以此英文版本为准。
   - 找不到 CHANGELOG 或该版本条目 → **暂停**，问用户 notes 来源（手写 / `--generate-notes` 自动生成 / 简短描述）。

5. **打 annotated tag**
   - `git tag -a <tag> -m "<title>" -m "<body>"`（title 与 body 分两个 `-m`；body 多行直接用换行）。
   - message 末尾**不加** `Co-Authored-By`（tag 非提交，无需署名）。

6. **推送 tag**
   - `git push origin <tag>`。
   - 若被拒（远程已存在）→ 回到第 3 步异常处理（**不自行 `--force`**）。

7. **创建 GitHub Release**
   - 先 `gh release view <tag>` 确认是否已有 Release：
     - 无 → `gh release create <tag> --title "<title>" --notes "<notes>"`。
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
- 遇 tag 已存在、工作区脏、CHANGELOG 缺条目、Release 已存在等异常，**暂停询问**，不自行 force push / 删除 / 覆盖。
- 构建产物上传前确认产物存在；需构建时先暂停征得同意。
- 临时 notes 文件放 `tmp/` 并清理，不污染项目。
- 发布成功后删除本次构建的可分发产物（vsix / 压缩包 / 可执行包等），不删中间编译输出（`dist/`、`out/`、`build/`）与正式 `assets/`；异常暂停时保留产物。
- 推送或 Release 创建失败如实报告，不自行破坏性重试。

## 汇报

报告发布结果：版本号、tag 名、tag 指向的 commit（= HEAD）、推送是否成功、GitHub Release URL、Release title、上传的 asset 清单（若有）、已清理的本地构建产物（若有）；若因异常暂停，则列出异常详情与可选项。
