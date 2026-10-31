/**
 * macmini git 只读守卫（pi 端，tool_call 拦截）。
 *
 * 2026-10-31 用户立规，原话：「禁止 macmini 这台设备进行 git 写操作，git add / git commit /
 * git push 等等写操作全部禁止。」
 *
 * 为什么：本机（MacBook）与 macmini 的 `~/Developer` 与 `~/.pi/agent` 是逐字节双向镜像
 * （Syncthing），`.git` 也是逐文件同步的——两台机器同时对同一个仓库做 git 写操作，ref / index
 * 会互相覆盖，轻则产生「游离提交」，重则损坏索引；而 macmini 已切断 GitHub，写出来的提交
 * 最终仍得回本机重做 / 推送，纯属风险来源。所以 macmini 定位为「只读镜像 + 算力」：只跑
 * 计算、只产出文件，提交 / 发版 / 建 PR 一律在本机做，改动经镜像自动回流。
 *
 * 判定方式（白名单，最严）：
 *   ① 只有明确的只读子命令放行（status / diff / log / show / ls-files / rev-parse /
 *      branch 查询 / tag -l / config --get / remote -v / stash list ...）；
 *   ② 其余 git 子命令一律拦（add / commit / push / pull / fetch / reset / restore / merge /
 *      rebase / cherry-pick / revert / rm / mv / checkout / switch / clean / stash 写 /
 *      tag 写 / branch 写 / config 写 / remote 写 / worktree / submodule / init / clone /
 *      gc / filter-* / update-ref ... 全在内），**不在白名单的新子命令默认拦**；
 *   ③ gh 的写操作（PR / Release / Issue / repo 变更、api 非 GET）一并拦——macmini 不连 GitHub。
 *
 * 只在 macmini 上生效（hostname 判定，与 session-link 同口径）；本机（MacBook）零影响。
 * **无逃生门**：这是设备级只读约束，不设授权标记——需要提交时在本机做，不要在 macmini 想
 * 办法绕过（任何绕过行为都违反用户立规）。
 *
 * 覆盖面：`bash` 与 `background_run` 两条路径（只拦 bash 会被后台任务绕过）。
 * 第二层兜底：macmini 全局 git hook（`core.hooksPath` → `~/.pi/agent/patch/macmini-git-readonly/
 * hooks`），覆盖 pi 之外的进程（CC / 用户手动 / 脚本），但 git 自身没有 add 的钩子，
 * add / tag / reset 这类只靠本扩展拦。
 *
 * 局限（诚实）：按命令文本静态判断——把命令写进脚本文件再执行、或用 python / node 脚本调用
 * git 子进程，本扩展拦不住。它是下限防线，不是沙箱。
 */

import { hostname } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/** 当前机器是不是 macmini（与 session-link 的 role 判定同口径）。 */
export function isMacminiHost(host: string = hostname()): boolean {
	const h = host.toLowerCase();
	return h.includes("mac-mini") || h.includes("macmini");
}

/** 命令段切分：&& / || / ; / 换行 / 管道。 */
const SEGMENT_SPLIT = /&&|\|\||;|\n|\|/;

/** git 全局选项里「后面跟一个值」的那些（解析子命令时要一起跳过）。 */
const GIT_GLOBAL_OPTS_WITH_VALUE = new Set([
	"-C",
	"-c",
	"--git-dir",
	"--work-tree",
	"--exec-path",
	"--namespace",
	"--super-prefix",
	"--config-env",
	"--attr-source",
]);

/** 明确只读的 git 子命令（白名单；不在其中的一律拦）。 */
const GIT_READONLY = new Set([
	"status",
	"diff",
	"log",
	"show",
	"blame",
	"shortlog",
	"describe",
	"grep",
	"rev-parse",
	"rev-list",
	"ls-files",
	"ls-tree",
	"ls-remote",
	"cat-file",
	"for-each-ref",
	"show-ref",
	"name-rev",
	"merge-base",
	"merge-tree",
	"range-diff",
	"show-branch",
	"whatchanged",
	"cherry",
	"count-objects",
	"fsck",
	"verify-commit",
	"verify-tag",
	"get-tar-commit-id",
	"check-ignore",
	"check-attr",
	"check-ref-format",
	"var",
	"version",
	"help",
	"archive",
	"format-patch",
	"patch-id",
	"diff-tree",
	"diff-files",
	"diff-index",
	"unpack-file",
	"stripspace",
	"column",
	"interpret-trailers",
	"request-pull",
]);

/** 写动词：gh 的子命令链里出现即拦（gh 用黑名单，避免误伤大量只读子命令）。 */
const GH_WRITE_VERBS = new Set([
	"create",
	"delete",
	"edit",
	"merge",
	"close",
	"reopen",
	"comment",
	"review",
	"upload",
	"publish",
	"push",
	"archive",
	"unarchive",
	"transfer",
	"rename",
	"fork",
	"sync",
	"clone",
	"ready",
	"revert",
	"lock",
	"unlock",
	"cancel",
	"rerun",
	"dispatch",
	"enable",
	"disable",
	"import",
	"checkout",
	"update-branch",
	"set",
	"add",
	"remove",
	"delete-runs",
]);

/** gh 里「后面跟一个值」的常见选项（解析子命令链时要一起跳过）。 */
const GH_OPTS_WITH_VALUE = new Set([
	"-R",
	"--repo",
	"-H",
	"--hostname",
	"-L",
	"--limit",
	"-S",
	"--search",
	"-l",
	"--label",
	"-t",
	"--title",
	"-b",
	"--body",
	"-B",
	"--base",
	"--head",
	"-s",
	"--state",
	"--json",
	"--jq",
	"--template",
	"--assignee",
	"-a",
	"--milestone",
	"-m",
	"--reviewer",
	"-r",
	"--branch",
	"--notes",
	"--notes-file",
	"--tag",
	"--target",
	"--workflow",
	"--ref",
	"--field",
	"-f",
	"--raw-field",
	"-F",
	"--method",
	"-X",
	"--input",
	"--cache",
	"--header",
	"-p",
	"--body-file",
]);

interface Token {
	text: string;
	/** token 以引号开头 = 引号内的文本（如 echo "git commit"），不当命令看。 */
	quoted: boolean;
}

/** 引号感知切词：返回每个 token 及其是否「以引号开头」。 */
export function tokenize(seg: string): Token[] {
	const out: Token[] = [];
	let cur = "";
	let quote: '"' | "'" | null = null;
	let startedWithQuote = false;
	const push = () => {
		if (cur !== "") out.push({ text: cur, quoted: startedWithQuote });
		cur = "";
		startedWithQuote = false;
	};
	for (let i = 0; i < seg.length; i++) {
		const ch = seg[i];
		if (quote) {
			cur += ch;
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") {
			if (cur === "") startedWithQuote = true;
			quote = ch;
			cur += ch;
			continue;
		}
		if (/\s/.test(ch)) {
			push();
			continue;
		}
		cur += ch;
	}
	push();
	return out;
}

/** 去掉引号与命令替换外壳，返回可执行的程序名（`$(`、反引号、路径前缀都剥掉）。 */
function binName(tok: string): string | null {
	let s = tok.trim();
	if (!s) return null;
	s = s.replace(/^\$\(/, "").replace(/^`+/, "").replace(/^\(+/, "").replace(/^\{+/, "");
	if (!s) return null;
	s = s.replace(/[)`}]+$/, "");
	if (!s) return null;
	const base = s.split("/").pop() ?? s;
	return base || null;
}

/** 取 git / gh 之后的第一个非选项参数（跳过 `-C path` 这类带值全局选项）。 */
function firstSubcommand(args: Token[], withValue: Set<string>): string | null {
	for (let i = 0; i < args.length; i++) {
		const t = args[i];
		if (t.quoted) continue;
		const text = t.text.replace(/^["']|["']$/g, "");
		if (text.startsWith("-")) {
			if (withValue.has(text)) i++;
			continue;
		}
		return text;
	}
	return null;
}

/** 收集位置参数（非选项），带值选项连同其值一起跳过。 */
function positionals(args: Token[], withValue: Set<string>): string[] {
	const out: string[] = [];
	for (let i = 0; i < args.length; i++) {
		const t = args[i];
		const text = t.text.replace(/^["']|["']$/g, "");
		if (t.quoted) {
			out.push(text);
			continue;
		}
		if (text.startsWith("-")) {
			if (withValue.has(text)) i++;
			continue;
		}
		out.push(text);
	}
	return out;
}

/** 分支 / tag 查询类选项（出现即视为查询，不是创建）。 */
const LISTISH_FLAGS = [
	"-l",
	"--list",
	"-a",
	"--all",
	"-r",
	"--remotes",
	"-v",
	"-vv",
	"--verbose",
	"--show-current",
	"--contains",
	"--no-contains",
	"--merged",
	"--no-merged",
	"--points-at",
	"--sort",
	"--format",
	"--column",
	"--color",
	"--no-color",
	"--omit-empty",
];

/** `git branch` 的写选项（出现即拦；`-a` / `-v` 是查询，不在此列）。 */
const BRANCH_WRITE_FLAGS =
	/^(?:-d|-D|--delete|-m|-M|--move|-c|-C|--copy|-f|--force|-u|--set-upstream-to|--unset-upstream|--edit-description|--track|--no-track|--create-reflog)(?:=|$)/;

/** `git tag` 的写选项（`-a/-s/-u/-m/-F/-d/-f/--cleanup` 等；`-l/-v/-n` 是查询）。 */
const TAG_WRITE_FLAGS =
	/^(?:-a|-s|-u|-m|-F|--file|-d|--delete|-f|--force|--create-reflog|--cleanup|-e|--edit|--edit-description)(?:=|$)/;

const BRANCH_TAG_VALUE_OPTS = new Set([
	"--contains",
	"--no-contains",
	"--merged",
	"--no-merged",
	"--points-at",
	"--sort",
	"--format",
	"--column",
	"--color",
	"--no-color",
	"--abbrev",
	"--set-upstream-to",
	"-u",
	"-m",
	"--message",
	"-F",
	"--file",
	"--cleanup",
	"-n",
]);

/** `git branch` 判定：查询放行，创建 / 删除 / 改名 / 改上游一律拦。 */
export function checkBranch(args: Token[]): boolean {
	for (const t of args) {
		const text = t.text.replace(/^["']|["']$/g, "");
		if (BRANCH_WRITE_FLAGS.test(text)) return false;
	}
	const hasListish = args.some((t) =>
		LISTISH_FLAGS.some((f) => {
			const text = t.text.replace(/^["']|["']$/g, "");
			return text === f || text.startsWith(f + "=");
		}),
	);
	const pos = positionals(args, BRANCH_TAG_VALUE_OPTS);
	if (pos.length > 0 && !hasListish) return false;
	return true;
}

/** `git tag` 判定：-l / -v 等查询放行，其余（含创建 / 删除）拦。 */
export function checkTag(args: Token[]): boolean {
	for (const t of args) {
		const text = t.text.replace(/^["']|["']$/g, "");
		if (TAG_WRITE_FLAGS.test(text)) return false;
	}
	const hasListish = args.some((t) =>
		LISTISH_FLAGS.some((f) => {
			const text = t.text.replace(/^["']|["']$/g, "");
			return text === f || text.startsWith(f + "=");
		}),
	);
	const pos = positionals(args, BRANCH_TAG_VALUE_OPTS);
	if (pos.length > 0 && !hasListish) return false;
	return true;
}

/** `git config` 判定：读取放行，写入拦。 */
export function checkConfig(args: Token[]): boolean {
	const texts = args.map((t) => t.text.replace(/^["']|["']$/g, ""));
	if (
		texts.some((t) =>
			/^(?:--get|--get-all|--get-regexp|--get-urlmatch|-l|--list|--show-origin|--show-scope|--show-names|-z)$/.test(
				t,
			),
		)
	) {
		return true;
	}
	if (
		texts.some((t) =>
			/^(?:--add|--replace-all|--unset|--unset-all|--rename-section|--remove-section|-e|--edit|--fixed-value)$/.test(
				t,
			),
		)
	) {
		return false;
	}
	if (texts.some((t) => t.includes("=") && !t.startsWith("-"))) return false;
	const pos = positionals(args, new Set(["-f", "--file", "--blob", "--get", "--get-all", "--get-regexp"]));
	return pos.length <= 1;
}

/** `git remote` 判定：查看放行，增删改拦。 */
export function checkRemote(args: Token[]): boolean {
	const sub = firstSubcommand(args, new Set(["-v", "-n"]));
	if (sub === null) return true;
	return !/^(?:add|remove|rm|rename|set-url|set-branches|set-head|update|prune)$/.test(sub);
}

/** `git stash` 判定：list / show 放行，其余（push / pop / apply / drop / clear / branch）拦。 */
export function checkStash(args: Token[]): boolean {
	const sub = firstSubcommand(args, new Set());
	if (sub === null) return false; // 裸 stash = stash push
	return sub === "list" || sub === "show";
}

/** `git notes` 判定：裸命令 / list / show 放行，其余拦。 */
export function checkNotes(args: Token[]): boolean {
	const sub = firstSubcommand(args, new Set());
	if (sub === null) return true; // 裸 notes = notes list
	return sub === "list" || sub === "show";
}

/** `git worktree` 判定：list 放行，其余拦。 */
export function checkWorktree(args: Token[]): boolean {
	const sub = firstSubcommand(args, new Set());
	return sub === "list";
}

/** `git submodule` 判定：status / summary 放行，其余拦。 */
export function checkSubmodule(args: Token[]): boolean {
	const sub = firstSubcommand(args, new Set());
	return sub === "status" || sub === "summary";
}

/** `git reflog` 判定：裸命令 / show / exists 放行，expire / delete 拦。 */
export function checkReflog(args: Token[]): boolean {
	const sub = firstSubcommand(args, new Set());
	if (sub === null) return true; // 裸 reflog = show
	return sub === "show" || sub === "exists";
}

/** git 子命令 → 是否放行。 */
export function isGitSubcommandReadonly(sub: string, args: Token[]): boolean {
	if (GIT_READONLY.has(sub)) return true;
	switch (sub) {
		case "branch":
			return checkBranch(args);
		case "tag":
			return checkTag(args);
		case "config":
			return checkConfig(args);
		case "remote":
			return checkRemote(args);
		case "stash":
			return checkStash(args);
		case "notes":
			return checkNotes(args);
		case "worktree":
			return checkWorktree(args);
		case "submodule":
			return checkSubmodule(args);
		case "reflog":
			return checkReflog(args);
		default:
			return false;
	}
}

/** gh 判定：area + action 结构里出现写动词即拦；api 单独判定方法。 */
export function isGhReadonly(args: Token[]): boolean {
	const pos = positionals(args, GH_OPTS_WITH_VALUE);
	const area = pos[0];
	const action = pos[1];
	if (area === "api") {
		const texts = args.map((t) => t.text.replace(/^["']|["']$/g, ""));
		const mi = texts.findIndex((t) => t === "-X" || t === "--method");
		if (mi >= 0) {
			const method = (texts[mi + 1] ?? "GET").toUpperCase();
			return method === "GET" || method === "HEAD";
		}
		const hasField = texts.some((t) =>
			/^(?:-f|-F|--field|--raw-field|--input)$/.test(t) || /^--(?:field|raw-field|input)=/.test(t),
		);
		return !hasField;
	}
	if (area === undefined) return true;
	if (action !== undefined && GH_WRITE_VERBS.has(action)) return false;
	// `gh repo clone` / `gh pr checkout` 这类「area 后面直接跟写动词」已覆盖；
	// 再兜一层：动作缺省时只要 area 本身是写动词（gh create 不存在，纯防御）
	if (action === undefined && GH_WRITE_VERBS.has(area)) return false;
	return true;
}

export interface Verdict {
	blocked: boolean;
	hit?: string;
}

/**
 * 判定一条 shell 命令在 macmini 上是否要拦。
 * 导出供测试复用（测试脚本直接 import 本文件、不加载 pi 扩展钩子）。
 */
export function checkCommand(command: string): Verdict {
	if (!command) return { blocked: false };
	for (const segRaw of command.split(SEGMENT_SPLIT)) {
		const seg = segRaw.trim();
		if (!seg) continue;
		const toks = tokenize(seg);
		for (let i = 0; i < toks.length; i++) {
			const tok = toks[i];
			if (tok.quoted) continue;
			const bin = binName(tok.text);
			if (bin !== "git" && bin !== "gh") continue;
			const args = toks.slice(i + 1);
			if (bin === "git") {
				const sub = firstSubcommand(args, GIT_GLOBAL_OPTS_WITH_VALUE);
				if (sub === null) continue; // 裸 git / git --version
				const subIdx = args.findIndex(
					(t) => !t.quoted && t.text.replace(/^["']|["']$/g, "") === sub,
				);
				const rest = subIdx >= 0 ? args.slice(subIdx + 1) : args;
				if (!isGitSubcommandReadonly(sub, rest)) {
					return { blocked: true, hit: `git ${sub}` };
				}
				break;
			}
			if (!isGhReadonly(args)) {
				const act = positionals(args, GH_OPTS_WITH_VALUE).slice(0, 2).join(" ");
				return { blocked: true, hit: `gh ${act}`.trim() };
			}
			break;
		}
	}
	return { blocked: false };
}

export const DENY_REASON =
	"[git-readonly-guard] 已拦截：**macmini 是只读镜像机，git 写操作全部禁止**（2026-10-31 用户立规）。" +
	"本机与 MacBook 的 `~/Developer` / `~/.pi/agent` 是逐字节双向镜像，`.git` 也一起同步——" +
	"两边同时写 ref / index 会互相覆盖、产生游离提交甚至损坏索引；而且 macmini 不连 GitHub，" +
	"在这里写出来的提交最终仍要回本机重做。\n" +
	"禁止范围：add / commit / push / pull / fetch / tag（写）/ branch（写）/ reset / restore / " +
	"merge / rebase / cherry-pick / revert / rm / mv / checkout / switch / clean / stash（写）/ " +
	"config（写）/ remote（写）/ worktree / submodule / init / clone / gc / filter-* / update-ref 等" +
	"一切会改动 `.git` 或工作区的操作，以及 gh 的写操作（PR / Release / Issue / repo 变更）。" +
	"只读查询（status / diff / log / show / branch / tag -l / config --get / stash list 等）照常可用。\n" +
	"正确做法：在 macmini 上只做计算、只产出文件；提交 / 发版 / 建 PR 回 MacBook 做（改动会经镜像自动回流）。" +
	"没有逃生门——不要尝试加标记或换写法绕过。";

export default function (pi: ExtensionAPI) {
	// 非 macmini 直接不注册钩子（本机零开销）
	if (!isMacminiHost()) return;
	pi.on("tool_call", async (event) => {
		try {
			const toolName = (event as { toolName?: string }).toolName;
			if (toolName !== "bash" && toolName !== "background_run") return;
			const input = (event as { input?: { command?: string } }).input;
			const command = input?.command ?? "";
			if (!command) return;
			const verdict = checkCommand(command);
			if (verdict.blocked) {
				return { block: true, reason: DENY_REASON };
			}
		} catch {
			// 判定异常时不阻塞会话（与其它守卫一致）
		}
	});
}
