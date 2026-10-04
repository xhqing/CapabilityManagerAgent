/**
 * 密码库与密钥文件保护守卫（pi 端，tool_call 拦截）。
 *
 * 2026-10-04 用户立规（全局 CLAUDE.md「工作规则」配套工具强制）：KeePass 数据库
 * （`*.kdbx`）与密钥文件（`~/Key/` 下）是**不可再生资产**——内容一旦丢失无法恢复；
 * 更糟的是用户的同步方案（Syncthing 手机 ↔ Mac）会把本机删除**传播到对端**，
 * 一次误删 = 两端同时失去数据（对端只在 `.stversions` 里留下副本，需人工恢复）。
 * 背景：用户明确担心「AI 误删电脑端数据库文件」。
 *
 * 判定逻辑与 `~/.claude/hooks/pre-tool-use-guard.sh` 规则 7（CC / CodeBuddy /
 * Trae 端共用）同源，两处必须同步改，不能只改一边（「规矩必须配套工具强制」）。
 *
 * 拦截两类动作：
 * A) 文件类工具（write / edit）直接写受保护路径 —— 无逃生门，密码库只应由
 *    KeePassXC / KeePassDX 自身读写。确需程序化写入时走 bash + 授权标记。
 * B) bash / powershell 的删除、移动、清空、重定向覆盖命令命中受保护路径
 *    （rm / mv / unlink / shred / trash / truncate、find -delete、`>` 覆盖）。
 *
 * 受保护目标：任何含 `.kdbx` 的路径、`~/Key/` 与 `/Key/` 下的密钥文件、
 * 含 `KeePass` 的目录、`~/Sync` 同步根目录（`rm -rf ~/Sync` 这种连窝端的也拦）。
 * 绝对路径写作 `/Users/<用户名>/Sync` 通配、不硬编码个人路径（仓库既有规范：脚本统一用
 * `~` / `$HOME` 展开，便于开源镜像直接复用）。
 *
 * 逃生门：命令里含标记 `AI_AUTHORIZED_KDBX_OP`（例如用户明确要求清理旧备份时，
 * 经授权后加上）。未获授权不得擅自添加标记。
 *
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话（与 git-commit-guard /
 * version-guard / test-cases-guard 一致）。
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const AUTH_MARK = "AI_AUTHORIZED_KDBX_OP";

/** 受保护路径特征（两端同源，勿单端改动）。 */
export const PROTECTED =
	/(\.kdbx|KeePass|~\/Key\/|\$HOME\/Key\/|\/Key\/|~\/Sync|\$HOME\/Sync|\/Users\/[^/]+\/Sync)/;

/** 危险动作：删除 / 移动 / 清空 / find -delete / 重定向覆盖到受保护路径。 */
export const RISKY =
	/(^|[^A-Za-z0-9_])(rm|mv|unlink|shred|trash|truncate)([ \t]|$)|\s-delete([ \t]|$)|>[ \t]*[^ \t]*(\.kdbx|KeePass|Key\/)/;

export const BASH_DENY =
	"[kdbx-guard] 拦截：禁止对密码库（*.kdbx）、密钥文件（~/Key/ 下）或 KeePass 同步目录" +
	"执行删除 / 移动 / 覆盖类操作——内容丢了不可恢复，且同步会把本机删除传播到手机" +
	"（一次误删两端同时失去数据）。确需操作（例如经用户同意清理旧备份）时，在命令里加" +
	"标记 `# AI_AUTHORIZED_KDBX_OP` 再执行；未获授权不得擅自加标记。日常读写密码库请" +
	"通过 KeePassXC / KeePassDX 完成，不需要动文件本身。";

export const FILE_TOOL_DENY = (path: string) =>
	"[kdbx-guard] 拦截：禁止用写 / 编辑类工具直接改写受保护路径 `" +
	path +
	"`（密码库 / 密钥文件）。这类文件只应由 KeePassXC / KeePassDX 自身读写；确需操作请" +
	"改用 Shell 命令并带上授权标记 `# AI_AUTHORIZED_KDBX_OP`。";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			// A) 写 / 编辑类工具：目标路径命中受保护特征即拒绝
			if (event.toolName === "write" || event.toolName === "edit") {
				const path = (event.input as { path?: string })?.path ?? "";
				if (path && PROTECTED.test(path)) {
					return { block: true, reason: FILE_TOOL_DENY(path) };
				}
				return;
			}

			// B) Shell：危险动作 + 受保护路径同时命中才拦（避免误伤普通 rm / mv）
			if (isToolCallEventType("bash", event) || event.toolName === "powershell") {
				const command = (event.input as { command?: string })?.command ?? "";
				if (!command) return;
				if (command.includes(AUTH_MARK)) return;
				if (RISKY.test(command) && PROTECTED.test(command)) {
					return { block: true, reason: BASH_DENY };
				}
			}
		} catch {
			// 判定异常时不阻塞会话
		}
	});
}
