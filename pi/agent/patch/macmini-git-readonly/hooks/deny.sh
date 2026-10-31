#!/bin/sh
# macmini 只读镜像：git 写操作全局禁止（2026-10-31 用户立规）
# 规则见 ~/.pi/agent/CLAUDE.md「跨机协作」节；说明见同目录 README.md。
cat >&2 <<'MSG'
[macmini-git-readonly] 拒绝执行：这台机器（macmini）是只读镜像，git 写操作已全局禁止。

原因：两机 ~/Developer 与 ~/.pi/agent 是逐字节双向镜像，.git 也一起同步——两台机器同时写
      ref / index 会互相覆盖，轻则产生游离提交，重则损坏索引；macmini 也不连 GitHub，
      在这里写出来的提交最终仍要回本机重做。

正确做法：macmini 只做计算、只产出文件，改动经镜像自动回流本机；提交 / 发版 / 建 PR
          一律回 MacBook 做。（2026-10-31 用户立规；无逃生门，不要绕过。）
MSG
exit 1
