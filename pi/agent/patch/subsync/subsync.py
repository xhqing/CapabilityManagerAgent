#!/usr/bin/env python3
"""subsync —— 订阅地址改写服务。

解决的问题：机场（订阅服务商）下发的订阅里，节点地址写的是裸 IP。机场换 IP 后，
手机里存的旧 IP 全部失效，只能重新导入；而「更新订阅」本身又常因请求被塞进
已失效的节点而失败。

本服务把订阅内容里的 IP 地址自动替换成对应的域名（先用 DNS 校验域名确实解
析到同一个 IP，校验不通过就原样保留），于是 IP 怎么换、客户端都能靠 DNS 自动
跟随，再也不需要重新导入。

设计要点：
- 只读：不改动上游订阅，只做转述。
- 两道鉴权：随机令牌路径 + 自定义请求头密钥。
- 只绑一个接口（配置文件里的 bind），默认只对 Tailscale 网卡可见。
- 结果缓存，避免每次请求都去打机场的订阅接口。

配置文件默认 ~/.config/subsync/config.json，可用环境变量 SUBSYNC_CONFIG 覆盖。
"""

import base64
import ipaddress
import json
import os
import re
import socket
import sys
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CONFIG_PATH = os.environ.get(
    "SUBSYNC_CONFIG", os.path.expanduser("~/.config/subsync/config.json")
)

DOMAIN_RE = re.compile(
    r"([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+)"
)

_cache = {}
_cache_lock = threading.Lock()

# 每个源最后一次成功生成的订阅内容。上游暂时拉不到时用它顶上，
# 避免客户端拿到 502 后什么都没更新。
_last_good = {}
_last_good_lock = threading.Lock()


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def log(message):
    line = "[%s] %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), message)
    print(line, flush=True)


def is_ip(value):
    if not value:
        return False
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def resolve(domain):
    """解析域名，返回 IP 集合；失败返回空集合。"""
    try:
        infos = socket.getaddrinfo(domain, None)
    except (socket.gaierror, UnicodeError, OSError):
        return set()
    return {info[4][0] for info in infos}


def resolve_cached(domain, ttl, memo):
    """带进程内缓存的解析，避免同一次请求里重复查同一个域名。"""
    now = time.time()
    hit = memo.get(domain)
    if hit and now - hit[0] < ttl:
        return hit[1]
    ips = resolve(domain)
    memo[domain] = (now, ips)
    return ips


def candidates_from_remark(remark):
    """从备注里挑出可能的域名，按出现顺序去重。"""
    found = []
    for match in DOMAIN_RE.finditer(remark or ""):
        domain = match.group(1)
        if is_ip(domain) or not domain:
            continue
        if domain not in found:
            found.append(domain)
    return found


def pick_domain(host, remark, memo, dns_ttl, stats):
    """为某个 IP 找出解析到同一 IP 的域名；找不到返回 None。"""
    for domain in candidates_from_remark(remark):
        ips = resolve_cached(domain, dns_ttl, memo)
        if host in ips:
            stats["checked"] += 1
            return domain
        if ips:
            stats["mismatch"].append("%s(%s)!=%s" % (domain, ",".join(sorted(ips)), host))
    stats["checked"] += 1
    return None


def split_link(link):
    """拆成 (主体, 备注)。"""
    if "#" in link:
        body, _, remark = link.partition("#")
        return body, urllib.parse.unquote(remark)
    return link, ""


def rewrite_hostport(hostport, new_host):
    """把 host:port 里的 host 换掉，port 原样保留。"""
    if hostport.startswith("["):  # IPv6 字面量
        end = hostport.find("]")
        if end == -1:
            return hostport
        tail = hostport[end + 1:]
        return "[%s]%s" % (new_host, tail)
    if ":" in hostport:
        _, _, port = hostport.rpartition(":")
        return "%s:%s" % (new_host, port)
    return new_host


def rewrite_standard(scheme, body, host_field):
    """处理 scheme://userinfo@host:port[/path][?query] 这类结构。

    返回 (新链接, 是否改写成功)。
    """
    rest = body[len(scheme) + 3:]
    if "@" not in rest:
        return None
    userinfo, _, tail = rest.rpartition("@")
    # 尾部可能是 host:port、host:port/path、host:port?query
    cut = len(tail)
    for sep in ("/", "?"):
        idx = tail.find(sep)
        if idx != -1 and idx < cut:
            cut = idx
    hostport, trailing = tail[:cut], tail[cut:]
    host = hostport.split(":")[0] if not hostport.startswith("[") else hostport
    if not is_ip(host):
        return None
    return "%s://%s@%s%s" % (scheme, userinfo, rewrite_hostport(hostport, host_field), trailing), True


def rewrite_ss(body, host_field):
    """Shadowsocks 有两种写法，都要支持。"""
    rest = body[5:]
    if "@" in rest:
        userinfo, _, tail = rest.rpartition("@")
        cut = len(tail)
        for sep in ("/", "?"):
            idx = tail.find(sep)
            if idx != -1 and idx < cut:
                cut = idx
        hostport, trailing = tail[:cut], tail[cut:]
        host = hostport.split(":")[0]
        if not is_ip(host):
            return None
        return "ss://%s@%s%s" % (userinfo, rewrite_hostport(hostport, host_field), trailing), True
    # 旧写法：整段是 base64
    try:
        padded = rest + "=" * (-len(rest) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode()).decode("utf-8")
    except Exception:
        return None
    if "@" not in decoded:
        return None
    userinfo, _, hostport = decoded.rpartition("@")
    host = hostport.split(":")[0]
    if not is_ip(host):
        return None
    payload = "%s@%s" % (userinfo, rewrite_hostport(hostport, host_field))
    encoded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return "ss://%s" % encoded, True


def rewrite_vmess(body, host_field):
    """vmess 是 base64(JSON)，地址在 JSON 的 add 字段。"""
    payload = body[8:]
    try:
        padded = payload + "=" * (-len(payload) % 4)
        data = json.loads(base64.b64decode(padded).decode("utf-8"))
    except Exception:
        return None
    address = str(data.get("add", ""))
    if not is_ip(address):
        return None
    data["add"] = host_field
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return "vmess://%s" % base64.b64encode(raw).decode().rstrip("="), True


def extract_host(body, scheme):
    """从节点链接主体里取出当前的服务器地址。"""
    if scheme == "vmess":
        payload = body[8:]
        try:
            padded = payload + "=" * (-len(payload) % 4)
            return str(json.loads(base64.b64decode(padded).decode("utf-8")).get("add", ""))
        except Exception:
            return None
    rest = body[len(scheme) + 3:]
    if "@" not in rest:
        # 老写法：ss://base64(method:password@host:port)
        try:
            padded = rest + "=" * (-len(rest) % 4)
            decoded = base64.urlsafe_b64decode(padded.encode()).decode("utf-8")
        except Exception:
            return None
        if "@" not in decoded:
            return None
        return decoded.rpartition("@")[2].split(":")[0]
    tail = rest.rpartition("@")[2]
    cut = len(tail)
    for sep in ("/", "?"):
        idx = tail.find(sep)
        if idx != -1 and idx < cut:
            cut = idx
    return tail[:cut].split(":")[0]


def rewrite_link(link, memo, dns_ttl, stats):
    """改写单条节点链接。改写不了就原样返回。"""
    body, remark = split_link(link)
    scheme = body.split("://", 1)[0].lower() if "://" in body else ""
    if scheme not in ("ss", "vmess", "vless", "trojan", "hysteria2", "hy2", "tuic"):
        stats["skipped"] += 1
        return link

    # 先找出当前地址是不是 IP
    host = extract_host(body, scheme)

    if not host:
        stats["skipped"] += 1
        return link
    if not is_ip(host):
        stats["already_domain"] += 1
        return link

    domain = pick_domain(host, remark, memo, dns_ttl, stats)
    if not domain:
        stats["kept"].append(host)
        return link

    if scheme == "vmess":
        result = rewrite_vmess(body, domain)
    elif scheme == "ss":
        result = rewrite_ss(body, domain)
    else:
        result = rewrite_standard(scheme, body, domain)

    if not result:
        stats["skipped"] += 1
        return link

    new_link, _ = result
    if "#" in link:
        new_link += "#" + link.split("#", 1)[1]
    stats["rewritten"] += 1
    return new_link


def decode_subscription(raw):
    """机场通常返回 base64，也有的直接给明文，两种都兼容。"""
    text = raw.strip()
    if "://" in text:
        return text
    try:
        padded = text + "=" * (-len(text) % 4)
        decoded = base64.b64decode(padded, validate=False).decode("utf-8")
        if "://" in decoded:
            return decoded
    except Exception:
        pass
    return text


def fetch(url, timeout):
    request = urllib.request.Request(url, headers={"User-Agent": "subsync/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def get_source_text(url, cache_ttl, timeout):
    now = time.time()
    with _cache_lock:
        hit = _cache.get(url)
        if hit and now - hit[0] < cache_ttl:
            return hit[1], True
    raw = fetch(url, timeout)
    with _cache_lock:
        _cache[url] = (time.time(), raw)
    return raw, False


def build_subscription(url, cache_ttl, dns_ttl, timeout):
    """拉上游订阅并返回改写后的 base64 订阅内容。"""
    try:
        raw, from_cache = get_source_text(url, cache_ttl, timeout)
    except Exception as error:
        with _last_good_lock:
            fallback = _last_good.get(url)
        if not fallback:
            raise
        age = int(time.time() - fallback[0])
        log("上游拉取失败（%s），改用 %d 分钟前的成功结果" % (error, age // 60))
        return fallback[1], "上游不可用，沿用 %d 分钟前的成功结果（%s）" % (age // 60, fallback[2]), True
    plain = decode_subscription(raw)
    stats = {
        "rewritten": 0,
        "already_domain": 0,
        "checked": 0,
        "skipped": 0,
        "kept": [],
        "mismatch": [],
    }
    memo = {}
    links = []
    for line in plain.splitlines():
        line = line.strip()
        if not line:
            continue
        links.append(rewrite_link(line, memo, dns_ttl, stats))
    body = "\n".join(links)
    encoded = base64.b64encode(body.encode("utf-8")).decode()
    summary = "%d 条节点：改写 %d、本来就是域名 %d、保留 IP %d、跳过 %d%s" % (
        len(links),
        stats["rewritten"],
        stats["already_domain"],
        len(stats["kept"]),
        stats["skipped"],
        "（DNS 与上游 IP 不一致：%s）" % "; ".join(stats["mismatch"][:3]) if stats["mismatch"] else "",
    )
    with _last_good_lock:
        _last_good[url] = (time.time(), encoded, summary)
    return encoded, summary, from_cache


class Handler(BaseHTTPRequestHandler):
    config = None
    server_version = "subsync/1.0"

    def log_message(self, fmt, *args):  # 用统一日志，避免默认 stderr 噪音
        log("%s %s" % (self.client_address[0], fmt % args))

    def _send(self, code, body, content_type="text/plain; charset=utf-8"):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path in ("/healthz", "/health"):
            self._send(200, "ok\n")
            return

        match = re.fullmatch(r"/sub/([0-9a-f]{32})/?", path)
        if not match or match.group(1) != self.config["token"]:
            # 统一返回 404，不透露服务存在
            self._send(404, "not found\n")
            return

        if self.headers.get("X-Sub-Key") != self.config["key"]:
            log("拒绝：请求头密钥不正确（来自 %s）" % self.client_address[0])
            self._send(403, "forbidden\n")
            return

        query = urllib.parse.parse_qs(parsed.query)
        source = query.get("src", [self.config["source"]])[0]
        try:
            encoded, summary, from_cache = build_subscription(
                source,
                self.config.get("cache_ttl", 300),
                self.config.get("dns_ttl", 600),
                self.config.get("timeout", 20),
            )
        except Exception as error:  # 上游拉取失败
            log("上游订阅拉取失败：%s" % error)
            self._send(502, "upstream error\n")
            return

        log("%s订阅：%s" % ("命中缓存，" if from_cache else "已刷新，", summary))
        self._send(200, encoded)


def main():
    config = load_config()
    Handler.config = config
    raw_bind = config.get("bind", "127.0.0.1")
    binds = raw_bind if isinstance(raw_bind, list) else [raw_bind]
    port = int(config.get("port", 8787))
    servers = []
    for address in binds:
        server = ThreadingHTTPServer((address, port), Handler)
        servers.append(server)
        log("subsync 已在 %s:%s 启动" % (address, port))
    log("源订阅：%s" % (config.get("source", "")[:70] + "..."))
    threads = []
    for server in servers:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        threads.append(thread)
    try:
        while any(thread.is_alive() for thread in threads):
            time.sleep(1)
    except KeyboardInterrupt:
        log("收到中断，退出")
    finally:
        for server in servers:
            server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
