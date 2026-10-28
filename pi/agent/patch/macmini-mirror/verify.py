#!/usr/bin/env python3
"""逐字节校验本机 ↔ macmini 两个共享目录是否完全一致。

用法：python3 verify.py [developer|pi-agent|all]

做法：两端各自遍历目录，**严格按两边 .stignore 的实际规则**跳过排除项，对每个文件算
SHA-256 + 权限位，逐条比对；符号链接比较链接目标（含指向目录的链接）。
输出缺失 / 内容不同 / 权限不同的清单。
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
        "skip_exact": {".DS_Store"},
        "skip_prefix": ("._",),
        "skip_suffix": (".pyc",),
        "skip_rel": set(),
        "git_locks_only": True,
    },
    "pi-agent": {
        "local": HOME / ".pi/agent",
        "remote": "/Users/mac/.pi/agent",
        "skip_dirs": {"sessions", "state", "logs", "tmp", "npm", "bin", "intercom",
                      "__pycache__", ".stfolder", ".lock.d"},
        "skip_exact": {".DS_Store"},
        "skip_prefix": ("._",),
        "skip_suffix": (".pyc", ".log", ".lock"),
        "skip_rel": {
            "models-store.json", "mcp-cache.json", "mcp-npx-cache.json",
            "mcp-last-seen-version.json", "trust.json", "mcp-project-approvals.json",
            "skills/anysearch/runtime.conf",
            "patch/session-link/config.json", "patch/session-link/local-links.json",
            "patch/session-link/chain-registry.json",
        },
        "git_locks_only": False,
    },
}

SCANNER = r'''
import hashlib, json, os, sys
root = sys.argv[1]
cfg = json.loads(sys.argv[2])
skip_dirs, skip_exact = set(cfg["skip_dirs"]), set(cfg["skip_exact"])
skip_prefix, skip_suffix = tuple(cfg["skip_prefix"]), tuple(cfg["skip_suffix"])
skip_rel, git_locks_only = set(cfg["skip_rel"]), cfg["git_locks_only"]
out = {}
def skip_file(name, rel):
    if rel in skip_rel or name in skip_exact:
        return True
    if name.startswith(skip_prefix) or name.endswith(skip_suffix):
        return True
    if name.endswith(".lock"):
        if git_locks_only:
            return "/.git/" in "/" + rel
        return True
    return False
def record(full, rel):
    if os.path.islink(full):
        out[rel] = "L:" + os.readlink(full)
    elif os.path.isfile(full):
        h = hashlib.sha256()
        try:
            with open(full, "rb") as f:
                for chunk in iter(lambda: f.read(1 << 20), b""):
                    h.update(chunk)
        except OSError as e:
            out[rel] = "ERR:" + str(e)
            return
        out[rel] = "%s:%s" % (oct(os.stat(full).st_mode & 0o777), h.hexdigest())
for dirpath, dirnames, filenames in os.walk(root):
    rel_dir = os.path.relpath(dirpath, root)
    for d in list(dirnames):
        if d in skip_dirs:
            dirnames.remove(d)
            continue
        full = os.path.join(dirpath, d)
        rel = os.path.normpath(os.path.join(rel_dir, d))
        if os.path.islink(full):
            out[rel] = "L:" + os.readlink(full)
            dirnames.remove(d)
    for name in filenames:
        full = os.path.join(dirpath, name)
        rel = os.path.normpath(os.path.join(rel_dir, name))
        if skip_file(name, rel):
            continue
        record(full, rel)
print(json.dumps(out))
'''


def cfg_json(spec):
    out = {}
    for k in ("skip_dirs", "skip_exact", "skip_prefix", "skip_suffix", "skip_rel", "git_locks_only"):
        v = spec[k]
        out[k] = sorted(v) if isinstance(v, (set, tuple)) else v
    return json.dumps(out, sort_keys=True)


def scan_local(path, spec):
    out = subprocess.run([sys.executable, "-c", SCANNER, str(path), cfg_json(spec)],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def scan_remote(path, spec):
    cmd = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", REMOTE_HOST,
           "python3 - " + json.dumps(path) + " " + json.dumps(cfg_json(spec))]
    out = subprocess.run(cmd, input=SCANNER, capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def main():
    which = sys.argv[1] if len(sys.argv) > 1 else "all"
    names = list(FOLDERS) if which == "all" else [which]
    bad_total = 0
    for name in names:
        spec = FOLDERS[name]
        print(f"== {name} ==", flush=True)
        local = scan_local(spec["local"], spec)
        remote = scan_remote(spec["remote"], spec)
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
