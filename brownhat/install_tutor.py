"""
Tutor template patcher for the Frappe LMS Vue SPA.

The Frappe LMS frontend serves its HTML from one of several possible paths
depending on the LMS version and build pipeline. This module tries every
candidate path on install / migrate and patches whichever exists.

Whitelisted helpers for runtime debugging:
  /api/method/brownhat.install_tutor.status         — inspect patch state
  /api/method/brownhat.install_tutor.force_patch    — manually re-apply
  /api/method/brownhat.install_tutor.force_unpatch  — manually reverse
"""
import os
import frappe

SCRIPT_TAG = '<script src="/assets/brownhat/js/bh_tutor.bundle.js" defer></script>'
MARKER = "<!-- bh-tutor:injected -->"

# Candidate locations where the LMS frontend HTML may live. Try every one;
# patch all that exist (Vite source + dist + Frappe www).
CANDIDATE_PATHS = [
    ("lms", "www", "lms.html"),
    ("lms", "www", "lms", "index.html"),
    ("lms", "www", "index.html"),
    ("lms", "frontend", "index.html"),          # Vite source
    ("lms", "frontend", "dist", "index.html"),  # Vite build output
    ("lms", "public", "frontend", "index.html"),
    ("lms", "lms", "www", "lms.html"),          # alternate layout
]


def _candidate_files():
    out = []
    for parts in CANDIDATE_PATHS:
        try:
            p = frappe.get_app_path(*parts)
            out.append((p, os.path.exists(p)))
        except Exception:
            out.append(("/".join(parts), False))
    return out


def _patch_one(path):
    """Patch a single HTML file. Returns 'patched' | 'already' | 'no-head' | 'unwritable' | 'error:<msg>'."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return f"read-error:{e}"

    if MARKER in content:
        return "already"

    snippet = f"\n\t{MARKER}\n\t{SCRIPT_TAG}\n"
    if "</head>" in content:
        new_content = content.replace("</head>", snippet + "</head>", 1)
    elif "<body" in content:
        new_content = content.replace("<body", snippet + "<body", 1)
    else:
        return "no-head"

    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        return "patched"
    except PermissionError:
        return "unwritable"
    except Exception as e:
        return f"error:{e}"


def _unpatch_one(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        return f"read-error:{e}"

    if MARKER not in content:
        return "already-clean"

    new_lines = [
        ln for ln in content.splitlines(keepends=True)
        if MARKER not in ln and "bh_tutor.bundle.js" not in ln
    ]
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write("".join(new_lines))
        return "unpatched"
    except PermissionError:
        return "unwritable"
    except Exception as e:
        return f"error:{e}"


def patch_lms_template():
    """Inject the tutor <script> into every LMS HTML candidate that exists."""
    results = {}
    for path, exists in _candidate_files():
        if not exists:
            results[path] = "not-found"
            continue
        results[path] = _patch_one(path)
    frappe.logger().info(f"brownhat tutor patch results: {results}")
    return results


def unpatch_lms_template():
    """Remove the tutor <script> from every LMS HTML candidate that has it."""
    results = {}
    for path, exists in _candidate_files():
        if not exists:
            results[path] = "not-found"
            continue
        results[path] = _unpatch_one(path)
    return results


@frappe.whitelist()
def status():
    """Diagnostic: report state of every candidate path. Callable via API."""
    out = []
    for path, exists in _candidate_files():
        entry = {"path": path, "exists": exists}
        if exists:
            try:
                with open(path, "r", encoding="utf-8") as f:
                    c = f.read()
                entry["patched"] = MARKER in c
                entry["has_head"] = "</head>" in c
                entry["writable"] = os.access(path, os.W_OK)
                entry["size"] = len(c)
            except Exception as e:
                entry["error"] = str(e)
        out.append(entry)
    return {
        "marker": MARKER,
        "script_tag": SCRIPT_TAG,
        "candidates": out,
    }


@frappe.whitelist()
def force_patch():
    """Manually re-run the patcher. Callable via API. Returns per-path results."""
    return patch_lms_template()


@frappe.whitelist()
def force_unpatch():
    """Manually reverse the patch on all paths. Callable via API."""
    return unpatch_lms_template()


@frappe.whitelist()
def find_lms_html():
    """Walk apps/lms looking for every .html file, with size + bh-tutor flag.
    Lets us discover which file Frappe is ACTUALLY serving for /lms."""
    import re
    try:
        lms_root = frappe.get_app_path("lms")
    except Exception as e:
        return {"error": f"can't resolve lms app: {e}"}

    parent = os.path.dirname(lms_root)  # apps/lms
    out = []
    for root, dirs, files in os.walk(parent):
        # skip node_modules, .git, __pycache__
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__")]
        for fn in files:
            if not fn.endswith((".html", ".vue")):
                continue
            path = os.path.join(root, fn)
            try:
                size = os.path.getsize(path)
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    head = f.read(2000)
                entry = {
                    "path": path,
                    "size": size,
                    "has_bh_tutor": "bh-tutor" in head or "bh_tutor" in head,
                    "has_head_tag": "</head>" in head,
                    "has_app_div": '<div id="app"' in head,
                }
                out.append(entry)
            except Exception as e:
                out.append({"path": path, "error": str(e)})
    return sorted(out, key=lambda x: x.get("size", 0), reverse=True)


@frappe.whitelist()
def read_file_head(path):
    """Return the first 2000 chars of an absolute file path (for debugging)."""
    if not isinstance(path, str) or not path.startswith("/home/frappe/frappe-bench/apps/"):
        return {"error": "path must be under /home/frappe/frappe-bench/apps/"}
    if not os.path.exists(path):
        return {"error": "not found"}
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return {"content": f.read(3000)}
