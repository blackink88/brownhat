"""
Tutor template patcher for the Frappe LMS Vue SPA.

The Frappe LMS frontend is served from a standalone Vite-built template at
`apps/lms/lms/www/lms.html`. It does NOT extend Frappe's `web.html`, so
standard `app_include_js` hooks do not inject scripts into LMS pages.

This module patches `lms.html` directly to add a <script> tag pointing at the
tutor widget bundle, which is served from `/assets/brownhat/js/bh_tutor.bundle.js`.

The patch is idempotent (marked with a comment) and is re-applied on every
`bench migrate` so it survives LMS app updates.
"""
import os
import frappe

SCRIPT_TAG = '<script src="/assets/brownhat/js/bh_tutor.bundle.js" defer></script>'
MARKER = "<!-- bh-tutor:injected -->"


def _lms_template_path():
    try:
        return frappe.get_app_path("lms", "www", "lms.html")
    except Exception:
        return None


def patch_lms_template():
    """Inject the tutor <script> tag into lms.html (idempotent)."""
    path = _lms_template_path()
    if not path or not os.path.exists(path):
        frappe.log_error(
            f"brownhat tutor: target template not found at {path}",
            "brownhat tutor install",
        )
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if MARKER in content:
        return  # already patched

    snippet = f"\n\t{MARKER}\n\t{SCRIPT_TAG}\n"
    if "</head>" in content:
        new_content = content.replace("</head>", snippet + "</head>", 1)
    else:
        new_content = content.replace("<body", snippet + "<body", 1)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    frappe.logger().info(f"brownhat tutor: patched {path}")


def unpatch_lms_template():
    """Remove the tutor <script> tag (idempotent)."""
    path = _lms_template_path()
    if not path or not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if MARKER not in content:
        return

    lines = content.splitlines(keepends=True)
    new_lines = [
        ln for ln in lines
        if MARKER not in ln and "bh_tutor.bundle.js" not in ln
    ]
    new_content = "".join(new_lines)

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    frappe.logger().info(f"brownhat tutor: unpatched {path}")
