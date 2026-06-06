"""
Compatibility stub. The Brown Hat tutor functionality has been removed.

This module exists only so that any cached references in Frappe hooks or
running processes can still import it without raising ImportError. All
functions are no-ops.
"""
import frappe


def patch_lms_template():
    """No-op. Tutor has been removed."""
    return {"status": "noop"}


def unpatch_lms_template():
    """No-op. Tutor has been removed."""
    return {"status": "noop"}


@frappe.whitelist()
def status():
    return {"status": "tutor-removed"}


@frappe.whitelist()
def force_patch():
    return {"status": "tutor-removed"}


@frappe.whitelist()
def force_unpatch():
    return {"status": "tutor-removed"}
