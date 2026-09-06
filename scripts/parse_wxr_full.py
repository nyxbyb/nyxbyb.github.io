#!/usr/bin/env python3
"""解析微信读书长截图 → 结构化读书记录(以书名行为锚, 全量)
处理全部细片, 滚动截屏重叠区用书名去重。"""
import re, json

SRC = '/tmp/all_ocr.txt'
OUT = '/Users/bao/Desktop/Caelum/data/微信读书/reading_records_full.json'

def clean_txt(t):
    return re.sub(r'\s+', ' ', t).replace('公钟', '分钟').strip()

def clean_title(title):
    # 书名应保留 中文/数字/字母/括号/点/书名号
    # 剔除OCR尾巴残留(如"肉证观察花记"这种粘连的旁边文字)
    title = re.sub(r'(肉证观察花记|个窺炬女孩的回忆|个规矩女疾的回忆|优秀|布驱冈际文掌奖获嫳作|阅读、游历和爱情|杀密关系|亲密关系|不生病|拟给阿尔吉侬的花束|优秀的绵丫|血观|为声|所烘著|DainBrosMnn|Beauuolr|Macgham|BIPH|GS)$', '', title.lstrip('“').rstrip('）)'))
    return title.strip()

# 1) 读入全部行
items = []
cur_file = None
for ln in open(SRC, encoding='utf-8'):
    ln = ln.rstrip('\n')
    if ln.startswith('### '):
        cur_file = ln[4:]; continue
    m = re.match(r'\[y=([\d.]+)\]\s*(.*)', ln)
    if m:
        items.append((cur_file, float(m.group(1)), m.group(2).strip()))

# 2) 以书名行为锚: 每条书名行=一条记录
recs = []
for i, (fn, y, text) in enumerate(items):
    mbook = re.search(r'《([^》]+)》', text)
    if not mbook: continue
    title = clean_title(mbook.group(1))
    if not title: continue
    # 时长: 同文件里向上找最近含小时/分钟的行(限y差<0.3)
    dur = ''
    j = i - 1
    while j >= 0 and items[j][0] == fn and items[i][1] - items[j][1] < 0.3:
        if re.search(r'\d+\s*(小时|分钟)', items[j][2]):
            dur = clean_txt(items[j][2]); break
        j -= 1
    # 完成: 同文件向下找最近含"读完"/年月(限y差<0.35)
    fin = ''
    j = i + 1
    while j < len(items) and items[j][0] == fn and abs(items[j][1] - y) < 0.35:
        c = items[j][2]
        if '读完' in c or re.search(r'\d{4}年|\d+月', c):
            fin = clean_txt(c); break
        j += 1
    recs.append({'title': title, 'duration_text': dur, 'finished': fin})

# 3) 跨片去重: 书名相同则合并(优先保留有时长的)
uniq = {}
for r in recs:
    k = r['title']
    if k not in uniq:
        uniq[k] = r
    else:
        if r['duration_text'] and not uniq[k]['duration_text']:
            uniq[k]['duration_text'] = r['duration_text']
        if r['finished'] and not uniq[k]['finished']:
            uniq[k]['finished'] = r['finished']
out = list(uniq.values())

def to_min(dt):
    if not dt: return None
    h = re.search(r'(\d+)\s*小时', dt); m = re.search(r'(\d+)\s*分钟', dt)
    return (int(h.group(1)) if h else 0)*60 + (int(m.group(1)) if m else 0)
for r in out:
    r['duration_min'] = to_min(r['duration_text'])

json.dump(out, open(OUT, 'w'), ensure_ascii=False, indent=1)
print(f"书名锚点 {len(recs)} 条(含跨片重复) → 去重后 {len(out)} 本")
# 无时长的书名(可能截到书名但没时长)统计
no_dur = [r for r in out if not r['duration_min']]
print(f"无时长(可能漏): {len(no_dur)}")
