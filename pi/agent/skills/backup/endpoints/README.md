# endpoints/：本机端点注册表与私有数据

此目录存放 backup skill 的**本机端点数据**，全部不随开源仓库分发（CapabilityManagerAgent 仓库 `.gitignore` 已忽略本目录内容，仅本 README 入库）：

- `endpoints.json`：端点注册表——登记每个已授权端点的：
  - 通用字段：name、display、type（`builtin-*` 或 `rclone`）、credential（凭证位置 + 用法）、reference（详情文档路径）、authorized_at、mode（备份模式）、file_formats（格式白名单）；
  - 私有字段（本机专属值，只存在这里，绝不进 skill 功能文件）：`root_folder_name` / `root_folder_token`（builtin-lark-cli 端点的云端根备份文件夹）、`notes`（本机环境细节，如代理配置）；
- `<name>.token` 等凭证文件：仅当某端点的凭证无法由工具自管（lark-cli auth / rclone config）时，才在本目录存独立凭证文件；工具能自管的一律自管，本目录不存冗余副本。

**设计原则**（「Skill 内容纯净性」）：skill 功能文件（SKILL.md / references / scripts）保持可开源纯净——对 clone 者有用的通用机制、命令与坑留在功能文件（机器差异用占位符表达），一切本机私有值放本目录，与凭证同模式。

## clone 者注意

clone CapabilityManagerAgent 后本目录只有这份 README（注册表与凭证不随仓库走）。首次使用 backup skill 前，按 `references/new-endpoint.md` 注册至少一个端点、生成自己的 `endpoints.json`（含你自己的云端根文件夹等私有值）。飞书端点的完整对接方法见 `references/feishu.md`。
