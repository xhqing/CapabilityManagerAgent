/**
 * 公开文本敏感自检守卫（pi 端，tool_call 拦截）。
 *
 * 按「规矩必须配套工具强制」元规则，为公开文本的敏感自检配套硬拦截：tag
 * message、Release notes、PR title / body、Issue 文本这些「会发出去的文字」
 * 在公开前都要求先做敏感检查，命令里没有 AI_SENSITIVE_CHECKED 标记一律 deny。
 *
 * 拦截范围（四类公开动作，都由公开文本承载）：
 * - 打 annotated tag（-a / --annotate / -m / --message / -F / --file）；
 * - 推送 tag（--tags / --follow-tags / refs/tags/ / refspec 形如版本号）；
 * - gh release create / edit；
 * - gh pr create / edit、gh issue create / edit。
 * 查询类（git tag -l、git push 普通分支、gh release/pr/issue 的 view/list 等）
 * 与本地删除类（git tag -d）不拦——拦截目标是把文字推向公开的动作，不是一切
 * 相关命令。commit message 也是公开文本，但敏感性无法从命令行文本自动判定，
 * 由 commit skill「公开文本敏感自检」节的纪律约束，不在本守卫的命令模式内。
 *
 * 与 ~/.claude/hooks/pre-tool-use-guard.sh 规则 6 的判定逻辑对齐（两端同步改，
 * 不能只改一边）。标记 AI_SENSITIVE_CHECKED 表示「将公开的文本已做敏感检查」：
 * 正式发版按 release skill 第 4 步自检、commit / PR / Issue 按 commit skill 的
 * 「公开文本敏感自检」节执行后再加；其它临时场景至少确认文本无敏感内容。
 * 判定全程防御性 catch：本扩展失灵时不阻塞会话（与其它 guard 一致）。
 *
 * （本文件 2026-10-03 由 release-guard.ts 更名而来，同日扩展 PR / Issue 覆盖。）
 */

import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CHECK_MARK = "AI_SENSITIVE_CHECKED";
// 与 git-commit-guard / version-guard 同源的 git 命令前缀匹配（含 git -C <path> 形态）
const GIT_PREFIX = String.raw`\bgit\s+(?:-\S+\s+(?:[^\s-][^\s]*\s+)?)*`;
// gh 命令前缀匹配（含 gh -R owner/repo 等全局选项形态）
const GH_PREFIX = String.raw`\bgh\s+(?:-\S+\s+(?:[^\s-][^\s]*\s+)?)*`;
// annotated tag 创建：tag 段内出现 -a/-m/-F 或对应长选项；[^;&|\n]* 限制在同一命令段内
const TAG_CREATE = new RegExp(
	GIT_PREFIX + String.raw`tag[^;&|\n]*(?:-[aAmF](?![a-zA-Z0-9])|--(?:annotate|message|file)(?![a-zA-Z0-9-]))`,
);
// tag 推送：--tags / --follow-tags / refs/tags/ / refspec 形如 v1.2.3
// 2026-10-04 修误伤：形如版本号的 refspec 必须是「裸 token」——前面不能是分支名字符
// （字母数字 / `/` / `.` / `-`）：`git push origin chore/bump-v1.4.0` 是推分支、不是推 tag，
// 旧写法不带前边界会把这种分支名误判为 tag 推送而拦下。（CC 钩子规则 6 同步修，用 `([^[:alnum:]/_.-]|^)` 表达同一约束。）
const TAG_PUSH = new RegExp(
	GIT_PREFIX +
		String.raw`push[^;&|\n]*(?:--tags(?![a-zA-Z0-9-])|--follow-tags(?![a-zA-Z0-9-])|refs/tags/|(?<![\w/.-])v?\d+\.\d+\.\d+(?![\w/.-]))`,
);
// GitHub Release 创建 / 编辑（notes 等公开文本）
const GH_RELEASE = new RegExp(GH_PREFIX + String.raw`release\s+(?:create|edit)(?![a-zA-Z0-9-])`);
// GitHub PR / Issue 创建 / 编辑（title / body 是公开文本）
const GH_PR_ISSUE = new RegExp(GH_PREFIX + String.raw`(?:pr|issue)\s+(?:create|edit)(?![a-zA-Z0-9-])`);

const DENY_REASON =
	"[public-text-guard] 拦截：公开动作（打 annotated tag / 推送 tag / 创建或编辑 " +
	"GitHub Release / PR / Issue）前必须先对将公开的文本（tag message、Release " +
	"notes、PR / Issue 的 title 与 body）做敏感检查——正式发版按 release skill " +
	"第 4 步「公开文本敏感自检」；commit / PR / Issue 按 commit skill 的「公开文本" +
	"敏感自检」节执行；其它场景至少确认待公开文本无敏感内容。确认后在命令末尾加" +
	"注释标记 `# AI_SENSITIVE_CHECKED` 再执行；不得未经检查擅自添加标记。";

export default function (pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		try {
			if (!isToolCallEventType("bash", event)) return;
			const command = event.input.command ?? "";
			if (command.includes(CHECK_MARK)) return;
			if (
				TAG_CREATE.test(command) ||
				TAG_PUSH.test(command) ||
				GH_RELEASE.test(command) ||
				GH_PR_ISSUE.test(command)
			) {
				return { block: true, reason: DENY_REASON };
			}
		} catch {
			// 判定异常时不阻塞会话
		}
	});
}
