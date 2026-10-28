#!/usr/bin/env python3
"""逐字节校验本机 ↔ macmini 两个共享目录是否完全一致。

用法：python3 verify.py [developer|pi-agent|all]

做法：两端各自遍历目录（跳过 .stignore 里声明的排除项），对每个文件算 SHA-256 +
权限位，逐条比对；输出缺失 / 内容不同 / 权限不同的清单。符号链接比较链接目标。
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

HOME = Path.home()
REMOTE_HOST = "mac-mini"

FOLDERS = {
    "developer": {
        "local": HOME / "Developer",
        "remote": "/Users/mac/Developer",
        "skip_dirs": {"node_modules", ".lake", ".venv", "venv", "__pycache__", ".stfolder"},
        "skip_rel": set(),
    },
    "pi-agent": {
        "local": HOME / ".pi/agent",
        "remote": "/Users/mac/.pi/agent",
        "skip_dirs": {"sessions", "state", "logs", "tmp", "npm", "bin", "intercom", "__pycache__", ".stfolder"},
        "skip_rel": {
            "models-store.json", "mcp-cache.json", "mcp-npx-cache.json",
            "mcp-last-seen-version.json", "trust.json", "mcp-project-approvals.json",
            "skills/anysearch/runtime.conf",
            "patch/session-link/config.json", "patch/session-link/local-links.json",
            "patch/session-link/chain-registry.json",
        },
    },
}

SCANNER = r'''
import hashlib, json, os, sys
root, skip_dirs, skip_rel = sys.argv[1], set(json.loads(sys.argv[2])), set(json.loads(sys.argv[3]))
out = {}
def bad(name):
    return (name == ".DS_Store" or name.startswith("._") or name.endswith(".pyc")
            or name.endswith(".log") or name.endswith(".lock") or name == ".lock.d")
for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [d for d in dirnames if d not in skip_dirs and not bad(d)]
    rel_dir = os.path.relpath(dirpath, root)
    for name in filenames:
        if bad(name):
            continue
        full = os.path.join(dirpath, name)
        rel = os.path.normpath(os.path.join(rel_dir, name))
        if rel in skip_rel:
            continue
        if os.path.islink(full):
            out[rel] = "L:" + os.readlink(full)
        elif os.path.isfile(full):
            h = hashlib.sha256()
            try:
                with open(full, "rb") as f:
                    for chunk in iter(lambda: f.read(1 << 20), b""):
                        h.update(chunk)
            except OSError as e:
                out[rel] = f"ERR:{e}"
                continue
            out[rel] = f"{oct(os.stat(full).st_mode & 0o777)}:{h.hexdigest()}"
print(json.dumps(out))
'''


def scan_local(path, skip_dirs, skip_rel):
    out = subprocess.run([sys.executable, "-c", SCANNER, str(path),
                          json.dumps(sorted(skip_dirs)), json.dumps(sorted(skip_rel))],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def scan_remote(path, skip_dirs, skip_rel):
    cmd = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", REMOTE_HOST,
           "python3 - " + json.dumps(path) + " " + json.dumps(json.dumps(sorted(skip_dirs)))
           + " " + json.dumps(json.dumps(sorted(skip_rel)))]
    out = subprocess.run(cmd, input=SCANNER, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    names = list(FOLDERS) if which == "all" else [which]
    bad_total = 0
    for name in names:
        spec = FOLDERS[name]
        print(f"== {name} ==", flush=True)
        local = scan_local(spec["local"], spec["skip_dirs"], spec["skip_rel"])
        remote = scan_remote(spec["remote"], spec["skip_dirs"], spec["skip_rel"])
        only_local = sorted(set(local) - set(remote))
        only_remote = sorted(set(remote) - set(local))
        diff = sorted(k for k in set(local) & set(remote) if local[k] != remote[k])
        print(f"  本机文件数 {len(local)}，macmini 文件数 {len(remote)}")
        print(f"  ✅ 完全一致 {len(set(local) & set(remote)) - len(diff)}")
        print(f"  ❌ 内容/权限不同 {len(diff)}")
        print(f"  ⚠️ 仅本机有 {len(only_local)}，仅 macmini 有 {len(only_remote)}")
        for label, items in (("仅本机", only_local), ("仅 macmini", only_remote), ("不同", diff)):
            for p in items[:10]:
                print(f"     {label}: {p}")
        bad_total += len(diff) + len(only_local) + len(only_remote)
    print("== 结论：逐字节一致 ==" if bad_total == 0 else f"== 结论：发现 {bad_total} 处差异 ==")
    return 0 if bad_total == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
