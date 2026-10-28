#!/usr/bin/env python3
"""本机 ↔ macmini 镜像状态检查。

用法：
  python3 status.py            # 人类可读
  python3 status.py --json     # 机器可读
  python3 status.py --check    # 给 launchd 用：异常时发通知（同一异常只提醒一次）

检查内容：两台机器的 Syncthing 是否在线、两个目录是否同步完成、有无错误、有无冲突副本。
"""
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

HOME = Path.home()
LOCAL = "http://127.0.0.1:8384"
REMOTE_HOST = "mac-mini"
FOLDERS = ["developer", "pi-agent"]
ROOTS = {
    "developer": (HOME / "Developer", "/Users/mac/Developer"),
    "pi-agent": (HOME / ".pi/agent", "/Users/mac/.pi/agent"),
}
LOCAL_CONFIG = HOME / "Library/Application Support/Syncthing/config.xml"
REMOTE_CONFIG = '"$HOME/Library/Application Support/Syncthing/config.xml"'
STATE_FILE = HOME / "Library/Logs/macmini-mirror-state.json"


def key_from(text):
    start = text.index("<apikey>") + len("<apikey>")
    return text[start:text.index("<", start)]


def local_key():
    return key_from(LOCAL_CONFIG.read_text())


def ssh(cmd, check=True):
    return subprocess.run(["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", REMOTE_HOST, cmd],
                          capture_output=True, text=True, check=check)


def remote_key():
    out = ssh(f'grep -o "<apikey>[^<]*" {REMOTE_CONFIG} | cut -d">" -f2')
    return out.stdout.strip().splitlines()[-1]


def api(base, key, path, remote=False):
    url = f"{base}/rest{path}"
    if remote:
        out = ssh(f"curl -s -H 'X-API-Key: {key}' '{url}'")
        data = out.stdout
    else:
        req = urllib.request.Request(url)
        req.add_header("X-API-Key", key)
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read().decode()
    return json.loads(data)


def count_conflicts(path):
    if not Path(path).exists():
        return 0, []
    out = subprocess.run(["find", str(path), "-name", "*.sync-conflict-*", "-not", "-path", "*/.git/*"],
                         capture_output=True, text=True)
    files = [l for l in out.stdout.splitlines() if l.strip()]
    return len(files), files[:5]


def collect():
    result = {"ok": True, "local": {}, "remote": {}, "conflicts": {}}
    try:
        lk = local_key()
        status = api(LOCAL, lk, "/system/status")
        result["local"]["id"] = status["myID"]
        conns = api(LOCAL, lk, "/system/connections")["connections"]
        result["remote"]["connected"] = any(v.get("connected") for k, v in conns.items()
                                            if k != status["myID"])
        result["remote"]["address"] = next((v.get("address") for k, v in conns.items()
                                            if k != status["myID"] and v.get("connected")), "")
        for f in FOLDERS:
            d = api(LOCAL, lk, f"/db/status?folder={f}")
            result["local"][f] = {
                "state": d["state"], "need_files": d["needTotalItems"],
                "need_bytes": d["needBytes"], "errors": d.get("errors", 0),
                "pull_errors": d.get("pullErrors", 0),
                "global_files": d["globalFiles"], "local_files": d["localFiles"],
            }
    except Exception as e:  # noqa: BLE001
        result["ok"] = False
        result["error"] = f"本机 Syncthing 不可用：{e}"
        return result

    try:
        rk = remote_key()
        for f in FOLDERS:
            d = api(LOCAL, rk, f"/db/status?folder={f}", remote=True)
            result["remote"][f] = {
                "state": d["state"], "need_files": d["needTotalItems"],
                "need_bytes": d["needBytes"], "errors": d.get("errors", 0),
                "pull_errors": d.get("pullErrors", 0),
                "global_files": d["globalFiles"], "local_files": d["localFiles"],
            }
            n, sample = count_conflicts(ROOTS[f][1])
            result["conflicts"][f] = {"count": n, "sample": sample}
    except Exception as e:  # noqa: BLE001
        result["ok"] = False
        result["error"] = f"macmini 不可达或 Syncthing 未运行：{e}"
        return result

    for f in FOLDERS:
        for side in ("local", "remote"):
            d = result[side][f]
            if d["state"] not in ("idle",) or d["need_files"] or d["errors"] or d["pull_errors"]:
                result["ok"] = False
        if result["conflicts"][f]["count"]:
            result["ok"] = False
    if not result["remote"]["connected"]:
        result["ok"] = False
    return result


def human(r):
    if "error" in r:
        return f"❌ {r['error']}"
    lines = []
    link = "✅ 已连接" if r["remote"]["connected"] else "❌ 未连接"
    lines.append(f"链路：{link}  {r['remote'].get('address', '')}")
    for f in FOLDERS:
        a, b = r["local"][f], r["remote"][f]
        ok = a["state"] == "idle" and b["state"] == "idle" and not a["need_files"] and not b["need_files"]
        lines.append(
            f"{'✅' if ok else '⏳'} {f}: 本机 {a['state']} {a['local_files']} 文件 / 待传 {a['need_files']}"
            f" | macmini {b['state']} {b['local_files']} 文件 / 待传 {b['need_files']}"
            f" | 错误 {a['errors'] + b['errors'] + a['pull_errors'] + b['pull_errors']}"
            f" | 冲突 {r['conflicts'][f]['count']}")
    return "\n".join(lines)


def notify(title, body):
    script = f'display notification {json.dumps(body)} with title {json.dumps(title)}'
    subprocess.run(["osascript", "-e", script], capture_output=True)


def check(r):
    """异常状态变化时通知一次（避免每 10 分钟重复弹）。"""
    prev = {}
    if STATE_FILE.exists():
        try:
            prev = json.loads(STATE_FILE.read_text())
        except Exception:  # noqa: BLE001
            prev = {}
    sig = json.dumps({"ok": r["ok"],
                      "conflicts": {f: r["conflicts"][f]["count"] for f in FOLDERS} if r["ok"] or "conflicts" in r else {},
                      "error": r.get("error", "")}, sort_keys=True)
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(sig)
    if r["ok"]:
        return
    if prev == json.loads(sig):
        return
    if "error" in r:
        notify("镜像异常", r["error"])
    else:
        bad = [f"{f} 冲突 {r['conflicts'][f]['count']} 个" for f in FOLDERS if r["conflicts"][f]["count"]]
        pending = [f"{f} 待传 {r['remote'][f]['need_files']} 文件" for f in FOLDERS if r["remote"][f]["need_files"]]
        notify("镜像异常", "；".join(bad + pending) or "同步未完成")


def main():
    r = collect()
    if "--json" in sys.argv:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(human(r))
    if "--check" in sys.argv:
        check(r)
    return 0 if r["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
