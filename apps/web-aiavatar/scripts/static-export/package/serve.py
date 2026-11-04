#!/usr/bin/env python3
"""本地预览服务：只用 Python 3 自带的库，只监听本机，不连任何后端。"""
import http.server
import json
import os
import re
import socket
import socketserver
import sys
import threading
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "site")


def compile_routes():
    """带 ID 的页面只预先生成了一份外壳（ID 写作 "_"），页面自己从地址栏读真正的 ID。"""
    with open(os.path.join(HERE, "routes.json"), encoding="utf-8") as f:
        routes = json.load(f)
    shells = []
    for route in routes:
        prefix, suffix = re.split(r"\[[^\]]+\]", route, maxsplit=1)
        ahead = "(?=" + re.escape(suffix) + ")" if suffix else "(?=$|[./])"
        shells.append((re.compile("^" + re.escape(prefix) + "[^/.]+" + ahead), prefix + "_"))
    return shells


SHELLS = compile_routes()


def to_shell(path):
    for pattern, shell in SHELLS:
        match = pattern.match(path)
        if match:
            # 把 "/projects/<id>.txt"、"/projects/<id>/__next.xxx.txt" 这样的路由数据也指回外壳。
            return shell + path[match.end():]
    return path


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _existing(self, path):
        for candidate in (path, path + ".html", path.rstrip("/") + "/index.html"):
            if os.path.isfile(self.translate_path(candidate)):
                return candidate
        return None

    def send_head(self):
        raw = self.path
        query = raw.split("?", 1)[1] if "?" in raw else ""
        path = raw.split("?", 1)[0].split("#", 1)[0]
        found = self._existing(path) or self._existing(to_shell(path))
        if found is None:
            self.send_error(404)
            return None
        self.path = found + ("?" + query if query else "")
        return super().send_head()

    def guess_type(self, path):
        if path.endswith(".txt"):
            return "text/x-component"
        if path.endswith(".webp"):
            return "image/webp"
        if path.endswith(".woff2"):
            return "font/woff2"
        return super().guess_type(path)

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def free_port(start=3013):
    for port in range(start, start + 50):
        with socket.socket() as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise SystemExit("3013 到 3062 的端口都被占用了")


def main():
    args = [a for a in sys.argv[1:] if a != "--no-open"]
    port = int(args[0]) if args else free_port()
    url = f"http://localhost:{port}/pages.html"
    server = Server(("127.0.0.1", port), Handler)
    print(f"Studio 静态版已启动：{url}\n关闭这个窗口即可停止。")
    if "--no-open" not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
