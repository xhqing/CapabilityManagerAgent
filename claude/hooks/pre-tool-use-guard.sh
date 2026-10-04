#!/bin/bash
# PreToolUse 守卫钩子（2026-08-30 用户立「规矩必须工具强制」后配套的硬约束）
# 拦截两类违规：
# 1) 杀 VSCode 进程前未授权——拦截对 VSCode 的 kill/pkill/killall（规则：杀 VSC 进程前必须先问）
# 2) 复用窗口的远程连接触发——拦截会复用当前窗口的 vscode:// URI open（规则：连接远程 VSCode Server 禁止复用当前窗口）

input=$(cat)

tool=$(echo "$input" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_name",""))' 2>/dev/null)
cmd=$(echo "$input" | /usr/bin/python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("command",""))' 2>/dev/null)

# --- 规则 7 前置：写 / 编辑类工具禁止直接改写密码库与密钥文件（2026-10-04 用户立）---
# 与 pi 端 kdbx-guard.ts 同源（两处判定同步改）。密码库（*.kdbx）与密钥文件
# （~/Key/ 下）只应由 KeePassXC / KeePassDX 自身读写；本段无逃生门，确需程序化
# 写入请改用 Bash 命令并带标记 AI_AUTHORIZED_KDBX_OP。
deny_msg() {
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"$1\"}}"
  exit 0
}

KDBX_PROT='(\.kdbx|KeePass|~/Key/|\$HOME/Key/|/Key/|~/Sync|\$HOME/Sync|/Users/[^/]+/Sync)'

# 判断命令里是否存在「以 git 开头的命令段」（按 && || ; | 换行 切分）且其子命令匹配 $1。
# 2026-10-04 收紧：只在段首为 git 时判定，避免文档 / 测试用例 / echo 文本里的
# "git commit" / "git tag" 被误判成真命令（实际误伤过：测试 payload 里的这句话
# 把 pi 端 git-status-guard 误触发了）。与 pi 端 git-commit-guard.ts 同源。
is_git_command() {
  local sub="$1" seg
  while IFS= read -r seg; do
    seg="${seg#"${seg%%[![:space:]]*}"}"
    [ -z "$seg" ] && continue
    if echo "$seg" | grep -qE "^git([[:space:]]+-[^[:space:]]+([[:space:]]+[^-[:space:]][^[:space:]]*)?)*[[:space:]]+${sub}([^[:alnum:]_-]|$)"; then
      return 0
    fi
  done < <(printf '%s\n' "$cmd" | sed -E 's/(&&|\|\||;|\|)/\n/g')
  return 1
}
case "$tool" in
  Write|Edit|MultiEdit|NotebookEdit|write_file|edit_file|replace_in_file|create_file|apply_patch)
    kdbx_fp=$(echo "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin).get("tool_input",{}) or {}; print(d.get("file_path") or d.get("notebook_path") or d.get("path") or "")' 2>/dev/null)
    if [ -n "$kdbx_fp" ] && echo "$kdbx_fp" | grep -qE "$KDBX_PROT"; then
      deny_msg "规则拦截：禁止用写 / 编辑类工具直接改写密码库（*.kdbx）或密钥文件（~/Key/ 下）——这类文件只应由 KeePassXC / KeePassDX 自身读写，且文件同步会把本机改动或删除传播到手机（一次误删两端同时失去数据）。确需程序化写入时，改用 Shell 命令并带标记 # AI_AUTHORIZED_KDBX_OP（用户授权后使用）。"
    fi
    ;;
esac

# 2026-09-03 T138：CodeBuddy IDE 宿主的 Bash 类工具名是 execute_command（CLI 风格才是
# Bash）；matcher 已双向别名匹配，但脚本内的 tool_name 判断要两个名字都认，否则在
# CodeBuddy 宿主静默跳过 = 挂了不生效。
if [ "$tool" != "Bash" ] && [ "$tool" != "execute_command" ]; then
  exit 0
fi
[ -z "$cmd" ] && exit 0


# --- 规则 1：杀 VSCode 进程（除非命令里带明确标记 AI_AUTHORIZED_KILL_VSC，由用户授权后使用）---
if echo "$cmd" | grep -qE '(kill|pkill|killall|osascript)[^;]*' ; then
  if echo "$cmd" | grep -qiE 'visual studio code|code helper|"code"|vscode|/code$| code( |$)' ; then
    if ! echo "$cmd" | grep -q 'AI_AUTHORIZED_KILL_VSC'; then
      deny_msg "规则拦截：杀 VSCode 进程前必须先用 AskUserQuestion 征得用户授权（全局 CLAUDE.md「杀 VSC 进程前必须先问」）。获得授权后在命令中加注释标记 # AI_AUTHORIZED_KILL_VSC 再执行。"
    fi
  fi
fi

# --- 规则 2：复用窗口的远程连接触发 ---
# open "vscode://vscode-remote/..." 会复用当前活动窗口，被全局规则禁止
if echo "$cmd" | grep -qE 'open[[:space:]]+(-na[[:space:]]+[^&|;]*)?["'"'"']?vscode://vscode-remote'; then
  deny_msg "规则拦截：open vscode:// URI 会复用用户当前窗口（全局 CLAUDE.md「连接远程 VSCode Server 禁止复用当前窗口」）。改用：code --folder-uri vscode-remote://ssh-remote+<host>/<path> --new-window"
fi

# --- 规则 3：git commit 未授权拦截（2026-09-21 用户立规：commit 不论分支/worktree/流程须明确授权）---
# 授权标记 AI_AUTHORIZED_COMMIT 仅四种场景使用：/commit skill 的串联命令、用户当轮明确授权后、/add 预检完全干净后的自动衔接（2026-10-01 增）、跨会话委派（其它 agent 依用户 2026-10-04 立的常设授权发起）；其余不得擅自加
# 2026-10-04 收紧：改用 is_git_command 只认「以 git 开头的命令段」——skill 里真实的
# 串联写法 `git commit -m "..." && git push # AI_AUTHORIZED_COMMIT` 仍在规则内
# （第一个段首为 git 的段命中 commit；标记在整条命令里），文档 / 测试用例 / echo
# 文本里的 "git commit" 不再误伤。与 pi 端 git-commit-guard.ts 同源。
if is_git_command 'commit'; then
  if ! echo "$cmd" | grep -q 'AI_AUTHORIZED_COMMIT'; then
    deny_msg "规则拦截：commit 需用户明确授权（不论分支 / worktree / 流程，全局 CLAUDE.md 铁律）。明确授权仅四种形式：用户主动触发 /commit、用户当轮消息明确授权 commit、/add 预检完全干净后的自动衔接、跨会话委派（其它 agent 依用户 2026-10-04 立的常设授权发起）。获得授权后在命令末尾加注释标记 # AI_AUTHORIZED_COMMIT 再执行；未获授权不得擅自加标记。"
  fi
fi

# --- 规则 4：X/Twitter 查询必须带账号隔离（2026-09-23 用户立规：防工具静默用运营号）---
# 背景：twitter-cli 默认遍历所有 Chrome profile 取第一个有 x.com cookie 的；不隔离时
# 查询专用号的 cookie 一旦失效，工具会静默切到运营号 → 运营号承担自动化访问风险。
# 隔离环境：~/.x-isolation.env（设 TWITTER_CHROME_PROFILE + 显式 cookie 固定查询号）
TW_SUB='(status|feed|search|tweet|article|user|user-posts|likes|followers|following|post|reply|like|retweet|bookmark|bookmarks|favorite|favorites|follow|list|show|quote|delete)'
if echo "$cmd" | grep -qE "(^|[[:space:];&|(])twitter([[:space:]]+-[^[:space:]]+)*[[:space:]]+${TW_SUB}\\b" \
   || echo "$cmd" | grep -qE '(^|&&|;|\|)[[:space:]]*twitter[[:space:]]+[^-[:space:]]' \
   || echo "$cmd" | grep -qE '(^|[[:space:];&|(])opencli[[:space:]]+twitter([[:space:]]|$)'; then
  if ! echo "$cmd" | grep -qE 'x-isolation\.env|TWITTER_CHROME_PROFILE|TWITTER_AUTH_TOKEN|AI_AUTHORIZED_X_UNSAFE'; then
    deny_msg "规则拦截：X/Twitter 查询必须先加载账号隔离（2026-09-23 立规，防工具静默切到运营号）。正确写法：. ~/.x-isolation.env && twitter status（先确认账号是查询专用号再继续）。隔离内容与原因见 ~/.x-isolation.env 注释。确需不带隔离时，命令加标记 # AI_AUTHORIZED_X_UNSAFE。"
  fi
fi

# --- 规则 5：VERSION 与群公告版本号必须一致（2026-10-02 用户立，硬性规定、工具强制）---
# 项目根 VERSION 与 docs/community/announcement.txt 的「版本：」行是同一套编号；
# 不一致时 commit / tag 一律拦截。三层同源：本规则、pi 端 version-guard.ts、
# 全局 git pre-commit hook（~/.config/git/hooks/pre-commit）；规则变更三处同步改。
# fail-closed：两侧文件都在而任一侧版本号解析不出（文件空 / 「版本：」行缺失）也拦。
if echo "$cmd" | grep -qE 'git[[:space:]]+(-[^[:space:]]+[[:space:]]+([^[:space:]-][^[:space:]]*[[:space:]]+)?)*(commit|tag)([^[:alnum:]_]|$)'; then
  if ! echo "$cmd" | grep -q 'VERSION_MISMATCH_OK'; then
    vc_root=$(git rev-parse --show-toplevel 2>/dev/null)
    vc_ver="$vc_root/VERSION"
    vc_ann="$vc_root/docs/community/announcement.txt"
    if [ -n "$vc_root" ] && [ -f "$vc_ver" ] && [ -f "$vc_ann" ]; then
      vc_a=$(tr -d '[:space:]' < "$vc_ver" | sed -E 's/^[vV]//')
      vc_b=$(grep -m1 -E '^[[:space:]]*版本[[:space:]]*[:：]' "$vc_ann" | sed -E 's/.*[:：][[:space:]]*[vV]?([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
      if [ "$vc_a" != "$vc_b" ]; then
        deny_msg "规则拦截：VERSION（${vc_a:-无法解析}）与群公告版本号（${vc_b:-无法解析}）不一致（2026-10-02 用户立的硬性规定：两者必须一致，bump 一个必须同步 bump 另一个）。先把两边改成同一个版本号再提交 / 打 tag；确需临时不一致时，命令加标记 # VERSION_MISMATCH_OK（用户授权后使用）。同源守卫：pi 端 version-guard.ts、全局 git pre-commit hook。"
      fi
    fi
  fi
fi

# --- 规则 6：公开文本敏感自检拦截（2026-10-03 立，release / commit skill 公开文本自检配套工具强制）---
# 公开动作四类：打 annotated tag（-a/--annotate/-m/--message/-F/--file）、推送 tag
# （--tags/--follow-tags/refs/tags/、refspec 形如版本号）、gh release create/edit、
# gh pr/issue create/edit（title / body 均为公开文本）。
# 命令带标记 AI_SENSITIVE_CHECKED 放行（语义：将公开的文本已做敏感检查）。
# 查询类（git tag -l、git push 普通分支、gh release/pr/issue view/list 等）与本地
# 删除类（git tag -d）不拦。同源守卫：pi 端 public-text-guard.ts（两端同步改）。
if ! echo "$cmd" | grep -q 'AI_SENSITIVE_CHECKED'; then
  if echo "$cmd" | grep -qE 'git[[:space:]]+(-[^[:space:]]+[[:space:]]+([^[:space:]-][^[:space:]]*[[:space:]]+)?)*tag[^;&|]*(-[aAmF]([^[:alnum:]]|$)|--(annotate|message|file)([^[:alnum:]-]|$))' \
     || echo "$cmd" | grep -qE 'git[[:space:]]+(-[^[:space:]]+[[:space:]]+([^[:space:]-][^[:space:]]*[[:space:]]+)?)*push[^;&|]*(--tags([^[:alnum:]-]|$)|--follow-tags([^[:alnum:]-]|$)|refs/tags/|v?[0-9]+\.[0-9]+\.[0-9]+)' \
     || echo "$cmd" | grep -qE '(^|[^[:alnum:]_])gh[[:space:]]+(-[^[:space:]]+[[:space:]]+([^[:space:]-][^[:space:]]*[[:space:]]+)?)*release[[:space:]]+(create|edit)([^[:alnum:]-]|$)' \
     || echo "$cmd" | grep -qE '(^|[^[:alnum:]_])gh[[:space:]]+(-[^[:space:]]+[[:space:]]+([^[:space:]-][^[:space:]]*[[:space:]]+)?)*(pr|issue)[[:space:]]+(create|edit)([^[:alnum:]-]|$)'; then
    deny_msg "规则拦截：公开动作（打 annotated tag / 推送 tag / 创建或编辑 GitHub Release / PR / Issue）前必须先对将公开的文本（tag message、Release notes、PR / Issue 的 title 与 body）做敏感检查——正式发版按 release skill 第 4 步「公开文本敏感自检」；commit / PR / Issue 按 commit skill「公开文本敏感自检」节（gitleaks + AI 三类语义检查）执行；其它场景至少确认待公开文本无敏感内容。确认后在命令末尾加注释标记 # AI_SENSITIVE_CHECKED 再执行；不得未经检查擅自添加标记。"
  fi
fi

# --- 规则 7：密码库 / 密钥文件的删除、移动、覆盖拦截（2026-10-04 用户立）---
# 背景：用户明确担心「AI 误删电脑端数据库文件」；文件型同步（Syncthing 手机 ↔ Mac）
# 会把本机删除传播到对端，一次误删 = 两端同时失去数据（对端只在 .stversions 留副本）。
# 保护对象：*.kdbx 数据库、~/Key/ 下的 keyfile、含 KeePass 的目录、~/Sync 同步根
# （含 rm -rf ~/Sync 这种连窝端的）；拦截动作：rm / mv / unlink / shred / trash /
# truncate、find -delete、> 重定向覆盖。逃生门：命令带标记 AI_AUTHORIZED_KDBX_OP。
# 绝对路径用 /Users/[^/]+/Sync 通配、不硬编码个人路径（仓库既有规范：脚本统一用
# ~ / $HOME 展开，开源镜像可直接复用）。
# 与 pi 端 kdbx-guard.ts 同源（两处判定同步改，不能只改一边）。
if echo "$cmd" | grep -qE '(^|[^[:alnum:]_])(rm|mv|unlink|shred|trash|truncate)([[:space:]]|$)|(^|[^[:alnum:]_])-delete([[:space:]]|$)|>[[:space:]]*[^[:space:]]*(\.kdbx|KeePass|Key/)'; then
  if echo "$cmd" | grep -qE "$KDBX_PROT"; then
    if ! echo "$cmd" | grep -q 'AI_AUTHORIZED_KDBX_OP'; then
      deny_msg "规则拦截：禁止对密码库（*.kdbx）、密钥文件（~/Key/ 下）或 KeePass 同步目录执行删除 / 移动 / 覆盖类操作——内容丢了不可恢复，且文件同步会把本机删除传播到手机（一次误删两端同时失去数据）。确需操作（例如经用户同意清理旧备份）时，在命令里加标记 # AI_AUTHORIZED_KDBX_OP 再执行；未获授权不得擅自加标记。日常读写密码库请通过 KeePassXC / KeePassDX 完成。"
    fi
  fi
fi
# --- 规则 8：禁止关闭用户终端里的会话 / 危险的 tmux 操作（2026-10-04 用户立）---
# 用户终端窗口里的 pi 会话（前台）他能看见、由他本人操作；agent 关闭后台会话只有一条
# 合法路径：`tmux kill-session -t <pi-名字>`。逃生门标记 AI_AUTHORIZED_SESSION_KILL。
# 与 pi 端 session-guard.ts 同源（判定逻辑同步改）。
if ! echo "$cmd" | grep -q 'AI_AUTHORIZED_SESSION_KILL'; then
  if echo "$cmd" | grep -qE '(^|[^[:alnum:]_])tmux[[:space:]]+kill-server([^[:alnum:]_-]|$)'; then
    deny_msg "规则拦截：禁止 tmux kill-server——会把用户自己的 tmux 会话一起端掉（2026-10-04 用户立规：终端里的会话由用户本人操作）。只关某一个后台会话请用 tmux kill-session -t <pi-名字>；确需 kill-server 时加标记 # AI_AUTHORIZED_SESSION_KILL（用户授权后使用）。"
  fi
  if echo "$cmd" | grep -qE 'tmux([[:space:]]+-[^[:space:]]+)*[[:space:]]+kill-session([^[:alnum:]_-]|$)' \
     && ! echo "$cmd" | grep -qE 'pi-[[:alnum:]_-]+'; then
    deny_msg "规则拦截：tmux kill-session 只能关 `pi-` 前缀的后台会话；用户终端里的会话及其它 tmux 会话由用户本人操作（2026-10-04 用户立规）。确需操作时加标记 # AI_AUTHORIZED_SESSION_KILL（用户授权后使用）。"
  fi
  if echo "$cmd" | grep -qE '(^|[^[:alnum:]_])(kill|pkill|killall)([[:space:]]|$)'; then
    if echo "$cmd" | grep -qE '(^|[^[:alnum:]_.-])pi([^[:alnum:]_]|$)|\.pi/agent|pi[[:space:]]+-n([^[:alnum:]_]|$)'; then
      deny_msg "规则拦截：禁止用 kill / pkill / killall 关闭 pi 会话——用户终端里的前台会话就在其中、由他本人操作（2026-10-04 用户立规）。关闭后台会话请用 tmux kill-session -t <pi-名字>；确需强杀时加标记 # AI_AUTHORIZED_SESSION_KILL（用户授权后使用）。"
    fi
    for pid in $(echo "$cmd" | grep -oE '(^|[[:space:];&|])[0-9]{2,7}([[:space:];&|]|$)' | tr -d ' ;&|' | sort -u); do
      case "$(ps -o command= -p "$pid" 2>/dev/null | head -1)" in
        pi|pi\ *)
          deny_msg "规则拦截：pid $pid 是 pi 会话进程（很可能是用户终端里的前台会话），禁止关闭（2026-10-04 用户立规）。关闭后台会话请用 tmux kill-session -t <pi-名字>；确需强杀时加标记 # AI_AUTHORIZED_SESSION_KILL（用户授权后使用）。"
          ;;
      esac
    done
  fi
fi

exit 0
