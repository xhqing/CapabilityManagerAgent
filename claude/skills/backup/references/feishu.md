# 飞书端点（feishu）

- 类型：`builtin-lark-cli`（内置端点，走飞书官方 CLI lark-cli）。
- 模式：`raw`——原文件直传（不打包压缩），格式白名单由注册表 `file_formats` 配置（glob 数组，大小写敏感，维护方式 = 改 `endpoints/endpoints.json`）。
- 凭证：lark-cli auth 自管，注册表只记位置与用法。
- **本机私有值不在此文档**：云端根备份文件夹（名字与 token）、本机代理细节等，登记在本机 `endpoints/endpoints.json` 的 `root_folder_*` / `notes` 字段；本文档只写通用方法，机器差异用 `<占位符>` 表达。
- 做飞书端点操作（备份、查看、恢复、重授权）前先读本文档。

## 云端目录布局（raw 直传 = 镜像相对路径）

- 根备份文件夹：注册表 `root_folder_name` / `root_folder_token` 所指的文件夹（备份脚本内置读写此配置）。
- 每个项目一个子文件夹（名字 = 项目名，脚本自动复用 / 创建）。
- 项目子文件夹内**镜像 `backup/` 的相对路径结构**：共享文件直接在项目文件夹下、`backup/<端点名>/` 专属文件在项目文件夹的 `<端点名>/` 子文件夹下、归档子目录（如 `backup/2026-09/`）同样按相对路径建文件夹。恢复 = 按路径放回 `backup/` 对应位置。
- 符号链接：直传的是链接指向的**实际内容**，云端文件名 = 链接名。

## 认证与授权

- `lark-cli auth status` 显示 user ready 即可用。
- 失效时 `lark-cli auth login --recommend`（浏览器授权一次，飞书域名必须直连）。
- **device code 一次一个**：重启会作废旧码——生成新链接后让用户**尽快**在浏览器完成（几分钟内有效），别反复重启。

## 坑（重要）

1. **代理坑**：本机若挂全局代理，飞书域名走代理会 TLS 握手超时——凡手敲 lark-cli 命令前必须 `export NO_PROXY="feishu.cn,.feishu.cn,larksuite.com,.larksuite.com,127.0.0.1,localhost"`（备份脚本内已内置；本机代理详情见注册表 `notes` 字段）。
2. **路径坑**：`drive +upload` 的 `--file` 与 `docs +create` 的 `--content` 只接受**当前目录内的相对路径**（绝对路径报 unsafe file path）——先 `cd` 到文件所在目录，或用 stdin 管道（`-`）；`+download` 的 flag 是 `--file-token`（不是 `--token`）。
3. **单文件 ≤20MB** 走整体上传（`+upload` 自动处理）；若有超大文件需分片，读 `lark-cli drive +upload --help`。
4. **list 元数据 size 可能为 0**：上传刚完成时 list 返回的 size 字段可能是空值，不代表文件为空——验证完整性要实际下载对比字节数 / md5。

## MD 文件转为飞书文档（docx）

**云端落位形态：`.md` 文件一律转成飞书文档（docx）再上传，不传原始 md 文件**——飞书文档可编辑、格式保留，原始 md 在飞书里只是死文件。`backup.sh` 对 `.md` 自动走此转换（标题 = 文件名去扩展名）。本地 `backup/<endpoint>/` 里的 md 副本照常保留（本地层不管格式）；云端层统一 docx。md 原件更新后，云端要**删旧 docx → 重新转换上传**（docx 不能像文件那样同名覆盖）。

手动转换命令（`<folder-token>` = 目标文件夹 token）：

```bash
export NO_PROXY="feishu.cn,.feishu.cn,larksuite.com,.larksuite.com,127.0.0.1,localhost"
cat <file>.md | lark-cli docs +create --doc-format markdown \
  --title "<文档标题>" --content - --parent-token <folder-token> --as user
```

三个坑：

1. `--content` 不接受绝对路径（同 +upload）——用 stdin 管道（`-`）。
2. **报错 ≠ 失败**：实测有命令报错（exit 1）但文档实际已创建成功（报错发生在响应解析阶段）——报错后先 `drive files list` 查目标文件夹，确认没建成功才重试，防重复创建；每次创建后同样 list 核对。
3. 删除 docx 类型必须 `--type docx`——`--type file` 对 docx **静默失败**（命令成功但什么都没删）。

## 查看与恢复

- 查看某项目云端备份：`lark-cli drive files list --folder-token <项目子文件夹token> --as user`（子文件夹 token 从根文件夹 token 的 list 结果里按项目名查；子目录文件再逐层 list）。
- 恢复：`lark-cli drive +download --file-token <token> --output <路径>` 下载，按云端相对路径放回 `backup/` 对应位置。
- 删除云端旧备份：`lark-cli drive +delete --file-token <token> --type <file|docx|folder> --as user --yes`（**type 必须与对象类型一致**，错 type 会静默失败）。删除是写操作，删除前向用户确认。
