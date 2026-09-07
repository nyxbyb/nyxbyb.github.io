#!/usr/bin/env python3
"""凿星图 · 嵌入 + 降维
读 corpus/books_raw.json（[{title, author, rating, source}]），
用 fastembed 的轻量中文模型嵌入，TSNE 降到 2D，输出前端用的 graph.json。
首次运行会从 HuggingFace 下载模型（~100MB）。
"""
import json, os, sys, time

BASE = os.path.expanduser("~/Desktop/Caelum")
RAW = os.path.join(BASE, "corpus/books_raw.json")
OUT = os.path.join(BASE, "web/public/data/graph.json")
# 微信读书"读完"记录(本地数据, 不进公开仓库)：并入星图并标已读
WXR = os.path.join(BASE, "data/微信读书/reading_records_full.json")
# 高中阅读记录(手写整理, 本地)
HS = os.path.join(BASE, "data/公众号/_backup/highschool_reading.json")
# 读书笔记提取的书目(本地)
NB = os.path.join(BASE, "data/公众号/_backup/notes_books.json")
# 网页添加的 inbox（提交到公开仓库，随时可读）
INBOX = os.path.join(BASE, "web/public/data/inbox.json")

MODEL = os.environ.get("EMBED_MODEL", "BAAI/bge-small-zh-v1.5")

def load_books():
    if not os.path.exists(RAW):
        sys.exit(f"找不到 {RAW}，先跑爬虫生成 books_raw.json")
    books = json.load(open(RAW))
    return books

def make_text(b):
    # 节点文本 = 标题 + 作者 + 评分提示，尽量简洁但可区分
    parts = [b.get("title", "")]
    if b.get("author"):
        parts.append(b["author"])
    if b.get("rating"):
        parts.append(f"评分{int(b['rating'])}")
    return " | ".join(parts)

def merge_wechat(books):
    """把 微信读书'读完' + 高中手写阅读 + 读书笔记书目 并入书单(公开亮起), 新书名补充嵌入。"""
    wxr = []
    if os.path.exists(WXR):
        try:
            wxr = json.load(open(WXR))
        except Exception as e:
            print(f"注意: 读取微信读书记录失败 {e}")
    hs = []
    if os.path.exists(HS):
        try:
            hs = json.load(open(HS))
        except Exception as e:
            print(f"注意: 读取高中阅读记录失败 {e}")
    nb = []
    if os.path.exists(NB):
        try:
            nb = json.load(open(NB))
        except Exception as e:
            print(f"注意: 读取读书笔记书目失败 {e}")
    inbox = []
    if os.path.exists(INBOX):
        try:
            inbox = json.load(open(INBOX))
            if not isinstance(inbox, list): inbox = []
        except Exception as e:
            print(f"注意: 读取 inbox 失败 {e}")
    if not wxr and not hs and not nb and not inbox:
        return books, {}
    by_title = {}
    notes_map = {}
    for r in list(wxr) + list(hs) + list(nb):
        by_title.setdefault(r["title"], r)
    # inbox: 新书/笔记 → 追加为已读(书名), 并记 notes
    for it in inbox:
        t = (it.get("title") or "").strip()
        if not t: continue
        entry = {"title": t, "finished": (it.get("finished") or ""), "duration_min": None, "duration_text": ""}
        if t not in by_title:
            by_title[t] = entry
        if it.get("type") == "note" or it.get("note"):
            notes_map.setdefault(t, []).append(it.get("note", "")[:500])
    # 记录已存在书名 → 更新状态为已读; 新书名 → 追加(用书名本身嵌入)
    merged = []
    read_meta = {}
    for b in books:
        rec = by_title.get(b.get("title"))
        if rec:
            m = {"source": "wxr", "duration_min": rec.get("duration_min"),
                 "finished": rec.get("finished", ""), "duration_text": rec.get("duration_text", "")}
            if t := b.get("title"):
                if notes_map.get(t):
                    m["notes"] = notes_map[t]
            read_meta[b["title"]] = m
        merged.append(b)
    added = 0
    for title, rec in by_title.items():
        if title and not any(b.get("title") == title for b in books):
            src_auth = "微信读书 · " if any(r["title"]==title for r in wxr) else (
                       "高中 · " if any(r["title"]==title for r in hs) else "读书笔记 · ")
            merged.append({"title": title, "author": src_auth + (rec.get("finished") or ""),
                           "rating": None, "source": "read"})
            m = {"source": "wxr", "duration_min": rec.get("duration_min"),
                 "finished": rec.get("finished", ""), "duration_text": rec.get("duration_text", "")}
            if notes_map.get(title):
                m["notes"] = notes_map[title]
            read_meta[title] = m
            added += 1
    print(f"合并已读记录: 微信读书 {len(wxr)} + 高中 {len(hs)} + 读书笔记 {len(nb)}, 新增书目 {added}, 已读标注 {len(read_meta)}")
    return merged, read_meta

def assign_domain(title, author=""):
    """用书名+作者关键词粗判学科域（用于轴语义化）。"""
    t = (title or "") + " " + (author or "")
    rules = [
        ("数学", ["数学", "代数", "几何", "拓扑", "微积分", "概率", "统计", "数论", "算法", "图论"]),
        ("计算机", ["计算", "计算机", "人工智能", "信息论", "编程", "软件", "数据", "神经网络", "深度", "机器", "脑", "语言模型"]),
        ("物理", ["物理", "量子", "相对论", "力学", "宇宙", "黑洞", "时间简史", "熵"]),
        ("化学", ["化学"]),
        ("生物", ["生物", "基因", "细胞", "神经", "物种", "生态", "进化", "演化"]),
        ("医学", ["医", "养生", "内经", "伤寒", "本草", "针灸", "药", "健康", "消化", "经络"]),
        ("文学", ["文学", "小说", "选集", "文集", "全集", "诗集", "散文", "诗", "传", "记", "记", "梦", "上校", "钟楼", "日瓦戈", "远大前程", "百年孤独", "红楼梦", "三国", "水浒", "西游记", "金庸", "笑傲", "射雕", "天龙", "变形记", "城堡", "局外人", "人间失格", "雪国", "围城", "边城", "呐喊", "朝花", "飘", "简爱", "傲慢与偏见", "悲惨世界", "巴黎圣母院", "战争与和平", "安娜", "罪与罚", "卡拉马佐夫", "卡拉马"]),
        ("哲学", ["哲学", "存在", "沉思录", "理想国", "会饮", "形而上学", "认识", "形而", "尼采", "康德", "海德格尔", "维特根斯坦", "萨特", "加缪", "存在主义", "道德", "伦理学", "逻辑哲学"]),
        ("心理学", ["心理", "精神分析", "弗洛伊德", "荣格", "自卑", "人格", "情绪", "认知", "梦的解析"]),
        ("历史", ["史", "通史", "史记", "资治", "年代", "春秋", "战国", "王朝", "帝", "剑桥", "人类简史", "未来简史"]),
        ("经济", ["经济学", "经济", "资本", "货币", "市场", "金融", "增长", "宏观", "微观", "博弈"]),
        ("政治", ["政治", "国家", "政体", "社会契约", "利维坦", "君主论", "权力", "民主"]),
        ("社会", ["社会", "乌合之众", "乡土", "身份", "群体", "文化"]) ,
        ("传记", ["自传", "回忆录", "传", "访谈"]),
        ("生活", ["原则", "习惯", "高效能", "财富", "人生的"]),
    ]
    for dom, kws in rules:
        for k in kws:
            if k and k in t:
                return dom
    return "综合"

def describe_axis(Y, books, axis_idx, topn=18):
    """给一条坐标轴取名：取两端书的学科域分布，归纳'高↔低'两端标签。
    注意：由于 TSNE random_state=42 固定，坐标稳定，故人工校准标签覆盖自动推断。"""
    import collections, numpy as np
    vals = Y[:, axis_idx]
    order = np.argsort(vals)
    low = order[:topn]      # 低端
    high = order[-topn:]    # 高端
    def doms(idx_list):
        c = collections.Counter(assign_domain(books[i].get("title",""), books[i].get("author","")) for i in idx_list)
        return c
    lc, hc = doms(low), doms(high)
    def top2(c):
        return "·".join([k for k,_ in c.most_common(2)])
    ltag, htag = top2(lc), top2(hc)
    # 若两端相同则取单一
    if ltag == htag:
        ltag, htag = top2(lc), top2(hc)
    return {"axis": axis_idx, "high": htag, "low": ltag}

# 人工校准轴标签（基于固定 seed 下实际坐标两端书名归纳，seed 变化需重标）
AXIS_LABELS = [
    {"low": "文学 · 浪漫", "high": "医学 · 养生"},
    {"low": "科幻 · 科技", "high": "经典 · 哲学"},
    {"low": "历史 · 杂览", "high": "心理 · 社会"},
]

def main():
    books = load_books()
    books, read_meta = merge_wechat(books)
    print(f"共 {len(books)} 本书（含微信读书并入）")

    print("加载嵌入模型...")
    from fastembed import TextEmbedding
    model = TextEmbedding(MODEL)
    texts = [make_text(b) for b in books]
    print(f"开始嵌入 {len(texts)} 条（首次会下载模型）...")
    t0 = time.time()
    vecs = list(model.embed(texts))
    dt = time.time() - t0
    print(f"嵌入完成，{len(vecs)} 条，耗时 {dt:.1f}s")

    import numpy as np
    X = np.array(vecs, dtype=np.float32)
    print(f"维度: {X.shape}")

    # 语义锚轴：用锚文本嵌入与每本书的相似度作为多维语义坐标（供沉浸式选轴）
    ANCHORS = [
        ("文学", "小说 诗歌 散文 故事 文学 人生 命运 爱情 叙事"),
        ("哲学", "哲学 存在 存在主义 形而上学 伦理 真理 思想 意义"),
        ("心理", "心理学 精神分析 潜意识 情绪 人格 认知 心理"),
        ("科学", "物理 宇宙 量子 生物 演化 科学 自然 规律"),
        ("医学", "医学 养生 中医 身体 健康 本草 针灸 内经"),
        ("数学", "数学 逻辑 算法 证明 数论 几何 计算 推理"),
        ("历史", "历史 文明 朝代 传记 时代 史学 记忆"),
        ("社会", "社会 政治 经济 权力 制度 乌合之众 阶层"),
        ("艺术", "艺术 绘画 音乐 美 视觉 设计 审美"),
        ("自我", "自我 成长 生活 习惯 人生智慧 超越 内心"),
    ]
    anchor_texts = [a[1] for a in ANCHORS]
    anchor_vecs = list(model.embed(anchor_texts))
    A = np.array(anchor_vecs, dtype=np.float32)
    A /= (np.linalg.norm(A, axis=1, keepdims=True) + 1e-9)
    Xn = X / (np.linalg.norm(X, axis=1, keepdims=True) + 1e-9)
    SEM = Xn @ A.T  # (n, n_anchor) cosine 相似度
    print(f"语义锚轴: {[a[0] for a in ANCHORS]}")

    # 正交语义轴：对 10 锚相似度做 PCA，取前 3 主成分（数学上严格正交），
    # 每轴按其正负极锚载荷命名（照应豆瓣/Goodreads/Amazon 的类别空间：文学/社科/哲学/科技/艺术…）
    anchor_names = [a[0] for a in ANCHORS]
    sem_centered = SEM - SEM.mean(axis=0)
    from numpy.linalg import svd as _svd
    U, S, Vt = _svd(sem_centered, full_matrices=False)
    ORTH = sem_centered @ Vt[:3].T   # 前 3 主成分得分 (n,3)
    # 各轴载荷
    orth_axes = []
    for k in range(3):
        loadings = Vt[k]
        high_i = int(np.argmax(loadings)); low_i = int(np.argmin(loadings))
        orth_axes.append({"axis": k, "high": anchor_names[high_i], "low": anchor_names[low_i],
                          "explained": round(float(S[k]**2 / (S**2).sum() * 100), 1)})
    print(f"正交轴(PCA): {[a['low']+'↔'+a['high']+'('+str(a['explained'])+'%)' for a in orth_axes]}")
    # 归一到 0~1
    ORTH -= ORTH.min(axis=0); ORTH /= (ORTH.max(axis=0) + 1e-9)

    print("TSNE 降维到 3D...")
    from sklearn.manifold import TSNE
    perp = min(30, max(5, len(books) // 5))
    t0 = time.time()
    Y = TSNE(n_components=3, perplexity=perp, random_state=42, init="pca").fit_transform(X)
    print(f"降维完成，耗时 {time.time()-t0:.1f}s")

    # 缩放到 0~1，便于前端坐标系
    Y -= Y.min(axis=0)
    Y /= Y.max(axis=0)

    nodes = []
    for i, (b, (x, y, z)) in enumerate(zip(books, Y)):
        meta = read_meta.get(b.get("title"), {})
        node = {
            "id": f"book_{len(nodes):04d}",
            "type": "book",
            "title": b.get("title"),
            "author": b.get("author", ""),
            "rating": b.get("rating"),
            "status": "read" if meta else "unread",
            "douban_rating": b.get("rating"),
            "x": round(float(x), 4),
            "y": round(float(y), 4),
            "z": round(float(z), 4),
            "sem": [round(float(v), 3) for v in SEM[i]],
            "orth": [round(float(v), 3) for v in ORTH[i]],
        }
        if meta:
            node["wechat"] = {
                "duration_min": meta.get("duration_min"),
                "duration_text": meta.get("duration_text") or "",
                "finished": meta.get("finished") or "",
            }
            if meta.get("notes"):
                node["notes"] = meta["notes"]
        nodes.append(node)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # 轴语义化：使用人工校准标签（TSNE seed 固定则坐标稳定）
    axes = []
    for i in range(3):
        axes.append({"axis": i, "low": AXIS_LABELS[i]["low"], "high": AXIS_LABELS[i]["high"]})
    json.dump({"nodes": nodes, "axes": axes, "orthaxes": orth_axes, "semanchors": [a[0] for a in ANCHORS]}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"✅ 已写 {OUT}，{len(nodes)} 个节点")
    print("  轴语义:")
    for a in axes:
        print(f"    轴{a['axis']}: 低={a['low']} ↔ 高={a['high']}")

if __name__ == "__main__":
    main()