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
    """把微信读书'读完'记录并入书单(公开亮起/卡片显示时长), 新书名则补充嵌入。"""
    wxr = []
    if os.path.exists(WXR):
        try:
            wxr = json.load(open(WXR))
        except Exception as e:
            print(f"注意: 读取微信读书记录失败 {e}")
    if not wxr:
        return books, {}
    by_title = {}
    for r in wxr:
        by_title.setdefault(r["title"], r)
    # 记录已存在书名 → 更新状态为已读; 新书名 → 追加(用书名本身嵌入)
    merged = []
    read_meta = {}
    for b in books:
        rec = by_title.get(b.get("title"))
        if rec:
            read_meta[b["title"]] = {"source": "wxr", "duration_min": rec.get("duration_min"),
                                     "finished": rec.get("finished", ""), "duration_text": rec.get("duration_text", "")}
        merged.append(b)
    added = 0
    for title, rec in by_title.items():
        if title and not any(b.get("title") == title for b in books):
            merged.append({"title": title, "author": "微信读书 · " + (rec.get("finished") or ""),
                           "rating": None, "source": "wechat"})
            read_meta[title] = {"source": "wxr", "duration_min": rec.get("duration_min"),
                                "finished": rec.get("finished", ""), "duration_text": rec.get("duration_text", "")}
            added += 1
    print(f"合并微信读书记录: {len(wxr)} 条, 新增书目 {added}, 已读标注 {len(read_meta)}")
    return merged, read_meta

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
    for b, (x, y, z) in zip(books, Y):
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
        }
        if meta:
            node["wechat"] = {
                "duration_min": meta.get("duration_min"),
                "duration_text": meta.get("duration_text") or "",
                "finished": meta.get("finished") or "",
            }
        nodes.append(node)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump({"nodes": nodes}, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"✅ 已写 {OUT}，{len(nodes)} 个节点")

if __name__ == "__main__":
    main()