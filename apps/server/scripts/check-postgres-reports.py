#!/usr/bin/env python3
"""真实 PostgreSQL 门禁不得缺报告、空跑或跳过。"""
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent.parent
sources = sorted((root / 'src/test/java').rglob('*PostgresIT.java'))
problems = []
total = 0
if not sources:
    problems.append('没有发现 PostgreSQL 验收类')
for source in sources:
    text = source.read_text()
    package = re.search(r'^package\s+([\w.]+);', text, re.M).group(1)
    name = package + '.' + source.stem
    report = root / 'target/surefire-reports' / ('TEST-' + name + '.xml')
    if not report.exists():
        problems.append(name + ' 缺少报告')
        continue
    suite = ET.parse(report).getroot()
    tests = int(suite.get('tests', '0'))
    total += tests
    if tests == 0 or any(int(suite.get(k, '0')) for k in ('failures', 'errors', 'skipped')):
        problems.append(name + ' 不是非零测试、零失败、零错误、零跳过')
if problems:
    print('\n'.join(problems), file=sys.stderr)
    sys.exit(1)
print(f'PostgreSQL 门禁通过：{len(sources)} 个验收类，{total} 项，零失败、错误、跳过')
