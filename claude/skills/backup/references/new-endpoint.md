# 注册新备份端点（首次授权流程）

用户提出「备份到 XX」而注册表（`endpoints/endpoints.json`）里没有 XX 时走本流程。目标：**一次授权，之后所有备份直接凭证登录、不再打扰用户**。

## 第〇步：先判定接入方式

- XX 是 **rclone 支持的远端**（WebDAV、S3、Google Drive、Dropbox、OneDrive、百度网盘等，`rclone list remotes` 与 rclone 官方文档可查）→ 走 **rclone 类型**：`rclone config` 配好远端（凭证由 rclone 自管，存 rclone 自己的配置），脚本零改动。
- XX 有专用 CLI / SDK（如飞书之于 lark-cli）→ 走**内置类型**：在 `scripts/backup.sh` 里加 `upload_<name>()` 分支 + case 分发。
- 都不行（只有裸 API）→ 与用户讨论方案（可能写小对接脚本），别自作主张。

判定原则：优先 rclone 类型——覆盖面广、凭证自管、脚本不用动；只有 rclone 覆盖不了或体验明显更差时才做内置类型。

## 四步授权

1. **向用户拿凭证**：问清凭证形态（OAuth 浏览器授权 / API token / 用户名密码），引导用户完成授权动作（凭证由用户提供，不由 skill 猜测或生成）。
2. **验证凭证可用**：用它做一次最小只读操作（列目录 / 查配额 / ping），通不过就回到第 1 步，别把没验证过的凭证登记进注册表。
3. **保存凭证**：
   - 工具自管（lark-cli auth、rclone config）→ 不额外存副本，注册表 credential 字段记「凭证位置 + 状态检查命令 + 失效时重授权命令」；
   - 需要 skill 自己存的 token / 密码 → 写 `endpoints/<name>.token`（该目录整体不进开源仓库），**绝不写进任何会被 git 跟踪的文件**（SKILL.md、references、CHANGELOG 都不行）。
4. **写使用方法并登记**：
   - 新建 `references/<name>.md`：云端目录布局、上传 / 查看 / 恢复 / 删除命令、该端点专属的坑；
   - 在 `endpoints/endpoints.json` 的 endpoints 数组追加一条：`name`（小写短名）、`display`（中文显示名）、`type`（`builtin-<工具>` 或 `rclone`）、`mode`（`raw` 原文件直传 / `archive` 打包 tar.gz，缺省 archive）、`file_formats`（可选，glob 格式白名单数组、大小写敏感，仅 raw 模式过滤生效）、`credential`（位置 + 用法）、rclone 类型再加 `remote`（rclone 远端名）与 `path`（远端根路径）、`reference`（文档路径）、`authorized_at`（日期）；
   - 内置类型还需改 `scripts/backup.sh`：加 `upload_<name>()` 函数 + case 分支（**脚本必须纯 ASCII**，注释与输出一律英文）。

## 验证与收尾

- 用小范围真备份一次到新端点（先 `--list` 确认范围，再 `--endpoint <name>` 单端执行），云端能看到包、能下载、解压后内容完整，才算注册完成。
- 向用户汇报：端点名、凭证存在哪、云端路径布局、之后怎么用（说「备份」即默认含此端点，或「备份到 XX」单指定）。
- 告知端点子目录用法：专属该端的文件可放各项目 `backup/<name>/`（只备份到该端），根下文件仍全端共享。
