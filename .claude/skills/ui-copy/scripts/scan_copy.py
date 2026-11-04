#!/usr/bin/env python3
"""扫出界面里可疑的中文文字。

用法（仓库根目录）：
  python3 -I .claude/skills/ui-copy/scripts/scan_copy.py apps/web-aiavatar/src
  python3 -I .claude/skills/ui-copy/scripts/scan_copy.py apps/web-aiavatar/src/ip --all
  python3 -I .claude/skills/ui-copy/scripts/scan_copy.py apps/web-aiavatar/src --spacing --exclude '*/proto/*'

默认只列命中规则的文字；--all 列出全部带中文的界面文字，方便整页通读；
--spacing 额外检查中文与英文、数字之间缺空格（存量多，默认不开）；
--strict 有命中时退出码为 1，可以接在检查链里。
只读文件，不改任何东西。规则说明见同目录上一级的 SKILL.md。
"""
import argparse
import fnmatch
import os
import re
import sys
from collections import Counter

CJK = re.compile(r"[一-鿿]")

RULES = [
    ("口语按钮/状态", re.compile(
        r"先存着|不拍了|接着做|存成第|原样再试|再拍一版|先去干别的|没拍成|回去接着|回首页接着|拍好了|再出一张"
        r"|正在拍(?!摄)|正在出|没成(?!功)|不写也行|可以不写|就行[了。！，」]?|搞定")),
    ("语气词结尾", re.compile(r"[吧啦哦呀嘛][。！!～~]?$")),
    ("翻译腔/空话", re.compile(r"打造|赋能|助力|一站式|全方位|轻松|即可|开启你的|之旅|无缝(?!背景)|极致")),
    ("开发词", re.compile(r"全局|实例|目录|节点\s?ID")),
    ("破折号", re.compile(r"——")),
    ("感叹号", re.compile(r"[！!]")),
    ("相对时间", re.compile(r"(?:\d+|几|一)\s?(?:秒|分钟|小时|天|周|个月)前|刚刚|昨天|前天|上周")),
    ("称呼用您", re.compile(r"您")),
    ("疑似内部词", re.compile(r"\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b[a-z]+[A-Z][a-zA-Z]+\b")),
    ("三个点", re.compile(r"\.\.\.")),
]
SPACING = ("中英文之间缺空格", re.compile(r"[一-鿿][A-Za-z0-9]|[A-Za-z0-9][一-鿿]"))

DEFAULT_EXCLUDE = ["*.test.*", "*.spec.*", "*/mocks/*", "*/__mocks__/*", "*/translations.ts", "*.d.ts",
                   "*/node_modules/*", "*/.next/*", "*/testing/*"]
# vendored 画布只扫它的中文语言包，其余文件是上游代码
VENDORED_CANVAS = "*/src/canvas/*"
VENDORED_KEEP = "*/src/canvas/locales/*"

ATTR = re.compile(r'(title|aria-label|placeholder|alt|label|description|message|tooltip|okText|cancelText)\s*[=:]\s*\{?\s*$')
# 字符串里装的是代码（内联脚本、着色器）时不当界面文字
CODE_LIKE = re.compile(r"function\s*\(|=>|&&|\|\||;\s*(var|let|const|if|return)\b|#ifdef|precision\s+\w+p\s+float|</?[a-z]+[ >]")
NOT_JSX = re.compile(r"['\"`;=()]")


def excluded(path, extra):
    p = path.replace(os.sep, "/")
    if any(fnmatch.fnmatch(p, pat) for pat in DEFAULT_EXCLUDE + extra):
        return True
    return fnmatch.fnmatch(p, VENDORED_CANVAS) and not fnmatch.fnmatch(p, VENDORED_KEEP)


def iter_files(paths, exts, extra):
    for root in paths:
        if os.path.isfile(root):
            yield root
            continue
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x not in ("node_modules", ".next", ".git")]
            for f in files:
                p = os.path.join(d, f)
                if os.path.splitext(f)[1] in exts and not excluded(p, extra):
                    yield p


def extract(src):
    """逐字符读源码，跳过注释，返回带中文的字符串和 JSX 文本：[(行号, 种类, 文字)]。"""
    out = []
    i, n, line = 0, len(src), 1

    def emit(no, kind, t):
        t = re.sub(r"\s+", " ", t).strip()
        if t and CJK.search(t) and not CODE_LIKE.search(t):
            out.append((no, kind, t))

    while i < n:
        c = src[i]
        if c == "\n":
            line += 1
            i += 1
        elif src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2)
            j = n if j < 0 else j + 2
            line += src.count("\n", i, j)
            i = j
        elif c == "/" and re.search(r"(^|[(,=:\[!&|?{};+\-*%~^]|\breturn)\s*$", src[max(0, i - 40):i]):
            # 正则字面量：跳到没有转义、不在字符类里的那个 /
            j, in_class = i + 1, False
            while j < n and src[j] != "\n":
                if src[j] == "\\":
                    j += 2; continue
                if src[j] == "[":
                    in_class = True
                elif src[j] == "]":
                    in_class = False
                elif src[j] == "/" and not in_class:
                    break
                j += 1
            i = j if j < n and src[j] == "\n" else j + 1
        elif c in "'\"":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            head = src[src.rfind("\n", 0, i) + 1:i]
            emit(line, "属性" if ATTR.search(head) else "字符串", src[i + 1:j])
            i = j if j < n and src[j] == "\n" else j + 1
        elif c == "`":
            j, buf, start = i + 1, [], line
            while j < n and src[j] != "`":
                if src[j] == "\\":
                    buf.append(src[j:j + 2]); j += 2; continue
                if src.startswith("${", j):
                    depth, j = 1, j + 2
                    while j < n and depth:
                        depth += {"{": 1, "}": -1}.get(src[j], 0)
                        if src[j] == "\n":
                            line += 1
                        j += 1
                    buf.append("…")
                    continue
                if src[j] == "\n":
                    line += 1
                buf.append(src[j]); j += 1
            emit(start, "字符串", "".join(buf))
            i = j + 1
        elif c == ">" and i > 0 and src[i - 1] not in "=-":
            j = i + 1
            while j < n and src[j] not in "<{}":
                j += 1
            text = src[i + 1:j]
            if CJK.search(text) and not NOT_JSX.search(text):
                emit(line, "界面文本", text)
                line += text.count("\n")
                i = j
            else:
                i += 1
        else:
            i += 1
    return out


def main():
    ap = argparse.ArgumentParser(description="扫出界面里可疑的中文文字")
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--all", action="store_true", help="列出全部带中文的界面文字")
    ap.add_argument("--spacing", action="store_true", help="检查中文与英文、数字之间缺空格")
    ap.add_argument("--strict", action="store_true", help="有命中时退出码为 1")
    ap.add_argument("--exclude", action="append", default=[], help="额外排除的路径模式，可重复")
    ap.add_argument("--ext", default=".tsx,.ts,.jsx,.js", help="要扫的扩展名，逗号分隔")
    a = ap.parse_args()

    rules = RULES + ([SPACING] if a.spacing else [])
    exts = {e if e.startswith(".") else "." + e for e in a.ext.split(",")}
    hits = Counter()
    total = 0
    for path in sorted(iter_files(a.paths, exts, a.exclude)):
        try:
            src = open(path, encoding="utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        for no, kind, t in extract(src):
            total += 1
            matched = [name for name, rx in rules if rx.search(t)]
            for name in matched:
                hits[name] += 1
            if matched or a.all:
                tag = "、".join(matched) if matched else kind
                print(f"{path}:{no}  [{tag}]  {t}")
    print(f"\n共检查 {total} 段带中文的文字。", file=sys.stderr)
    if hits:
        print("命中：" + "，".join(f"{k} {v}" for k, v in hits.most_common()), file=sys.stderr)
    else:
        print("没有命中规则。", file=sys.stderr)
    print("扫描只能抓词；信息是否真实、语气是否合适，要按 SKILL.md 第 3 步在页面上通读。", file=sys.stderr)
    return 1 if (a.strict and hits) else 0


if __name__ == "__main__":
    sys.exit(main())
