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
