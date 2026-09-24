#!/usr/bin/env python3
"""Extract sarapis.org WXR export into clean JSON for the Payload importer.

Outputs (to migration/out/):
  pages.json, posts.json   - published content with resolved parents/categories
  attachments.json         - id -> {url, title, filename} for media
  manifest.json            - counts + WP id -> {type, slug} map for link rewriting
"""
import json, os, re, sys
from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "sarapis.WordPress.2026-06-25.xml")
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
    "dc": "http://purl.org/dc/elements/1.1/",
}

def text(node, path):
    e = node.find(path, NS)
    return (e.text or "") if e is not None else ""

def postmeta(item):
    d = {}
    for m in item.findall("wp:postmeta", NS):
        k = text(m, "wp:meta_key"); v = text(m, "wp:meta_value")
        d[k] = v
    return d

def main():
    parser = etree.XMLParser(recover=True, huge_tree=True)
    tree = etree.parse(SRC, parser)
    root = tree.getroot()
    items = root.findall(".//item")

    id_map = {}          # wp id -> {type, slug, title}
    attachments = {}     # wp id -> {url, title, filename}
    pages, posts = [], []

    for it in items:
        pid = text(it, "wp:post_id")
        ptype = text(it, "wp:post_type")
        status = text(it, "wp:status")
        slug = text(it, "wp:post_name")
        title = (it.findtext("title") or "").strip()
        if pid:
            id_map[pid] = {"type": ptype, "slug": slug, "title": title}

        if ptype == "attachment":
            url = text(it, "wp:attachment_url")
            attachments[pid] = {
                "id": pid, "url": url, "title": title,
                "filename": os.path.basename(url) if url else "",
            }
            continue

        if ptype not in ("page", "post") or status != "publish":
            continue

        meta = postmeta(it)
        cats = [c.text for c in it.findall("category[@domain='category']") if c.text]
        rec = {
            "wpId": pid,
            "title": title,
            "slug": slug,
            "status": status,
            "parentId": text(it, "wp:post_parent"),
            "date": text(it, "wp:post_date_gmt") or text(it, "wp:post_date"),
            "content": text(it, "content:encoded"),
            "excerpt": text(it, "excerpt:encoded"),
            "thumbId": meta.get("_thumbnail_id", ""),
            "categories": cats,
        }
        (pages if ptype == "page" else posts).append(rec)

    # collect media URLs referenced in content (for selective import)
    referenced = set()
    url_re = re.compile(r'https?://[^\s"\'<>)]+\.(?:png|jpe?g|gif|svg|webp|pdf|mp4|webm)', re.I)
    for rec in pages + posts:
        for u in url_re.findall(rec["content"] or ""):
            referenced.add(u.split("?")[0])

    with open(os.path.join(OUT, "pages.json"), "w") as f: json.dump(pages, f, indent=2)
    with open(os.path.join(OUT, "posts.json"), "w") as f: json.dump(posts, f, indent=2)
    with open(os.path.join(OUT, "attachments.json"), "w") as f: json.dump(attachments, f, indent=2)
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump({
            "counts": {"pages": len(pages), "posts": len(posts),
                       "attachments": len(attachments), "referencedUrls": len(referenced)},
            "idMap": id_map,
            "referencedUrls": sorted(referenced),
        }, f, indent=2)

    print(json.dumps({"pages": len(pages), "posts": len(posts),
                      "attachments": len(attachments),
                      "referencedUrls": len(referenced)}, indent=2))

if __name__ == "__main__":
    main()
