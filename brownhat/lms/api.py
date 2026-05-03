"""
brownhat/lms/api.py — Whitelisted API endpoints for the lab orchestrator.

Deploy path inside your Frappe app: brownhat/lms/api.py
Each function decorated with @frappe.whitelist() becomes callable at:
  POST /api/method/brownhat.lms.api.<function_name>

The orchestrator (on labs01) calls these endpoints using its own API key/secret
(the orchestrator-bot service account).  The React frontend never calls these
directly — it goes through the Supabase frappe-proxy edge function.
"""

import hashlib
from datetime import datetime, timedelta

import frappe
from frappe import _


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _require_orchestrator():
    """Raise PermissionError if caller is not the orchestrator bot or a System Manager."""
    if frappe.session.user == "Guest":
        frappe.throw(_("Authentication required"), frappe.AuthenticationError)
    roles = frappe.get_roles(frappe.session.user)
    if "System Manager" not in roles:
        frappe.throw(_("Orchestrator role required"), frappe.PermissionError)


def _sha256(value: str) -> str:
    return hashlib.sha256(value.strip().encode()).hexdigest()


# ── Lab lifecycle (called by orchestrator) ──────────────────────────────────────

@frappe.whitelist()
def report_lab_start(student: str, lab_id: str, container_name: str,
                     connection_url: str = "", ttl_minutes: int = 60):
    """
    Called by the orchestrator when a container is successfully provisioned.
    Creates/updates a Student Lab record and logs a Lab Activity event.
    """
    _require_orchestrator()

    now = datetime.utcnow()
    expires_at = now + timedelta(minutes=int(ttl_minutes))

    # Upsert Student Lab (one active record per student+lab_id)
    existing = frappe.db.get_value(
        "Student Lab",
        {"student": student, "lab_id": lab_id, "status": ["in", ["Active", "Provisioning"]]},
        "name",
    )
    if existing:
        doc = frappe.get_doc("Student Lab", existing)
    else:
        doc = frappe.new_doc("Student Lab")
        doc.student = student
        doc.lab_id = lab_id

    doc.container_name = container_name
    doc.status = "Active"
    doc.started_at = now
    doc.expires_at = expires_at
    doc.connection_url = connection_url
    doc.save(ignore_permissions=True)

    # Log activity
    activity = frappe.new_doc("Lab Activity")
    activity.student = student
    activity.lab_id = lab_id
    activity.action = "Start"
    activity.container_name = container_name
    activity.success = 1
    activity.timestamp = now
    activity.save(ignore_permissions=True)

    frappe.db.commit()
    return {"status": "ok", "student_lab": doc.name, "expires_at": str(expires_at)}


@frappe.whitelist()
def report_lab_stop(student: str, lab_id: str, container_name: str):
    """
    Called by the orchestrator when a container is stopped or culled.
    Marks the Student Lab record as Deleted.
    """
    _require_orchestrator()

    now = datetime.utcnow()

    existing = frappe.db.get_value(
        "Student Lab",
        {"student": student, "lab_id": lab_id, "container_name": container_name},
        "name",
    )
    if existing:
        doc = frappe.get_doc("Student Lab", existing)
        doc.status = "Deleted"
        doc.save(ignore_permissions=True)

    activity = frappe.new_doc("Lab Activity")
    activity.student = student
    activity.lab_id = lab_id
    activity.action = "Stop"
    activity.container_name = container_name
    activity.success = 1
    activity.timestamp = now
    activity.save(ignore_permissions=True)

    frappe.db.commit()
    return {"status": "ok"}


# ── Flag submission (called by student via frappe-proxy) ────────────────────────

@frappe.whitelist()
def submit_flag(lab_id: str, flag: str):
    """
    Called when a student submits a flag.
    Compares SHA256(flag) against LMS Lesson.expected_flag_hash.
    Logs a Lab Activity record regardless of success.
    Returns {"correct": true/false}.
    """
    student = frappe.session.user
    if student == "Guest":
        frappe.throw(_("Authentication required"), frappe.AuthenticationError)

    # Find the lesson that owns this lab
    lesson_name = frappe.db.get_value("LMS Lesson", {"lab_id": lab_id}, "name")
    if not lesson_name:
        frappe.throw(_(f"No lesson found for lab_id '{lab_id}'"), frappe.DoesNotExistError)

    lesson = frappe.get_doc("LMS Lesson", lesson_name)
    expected_hash = lesson.get("expected_flag_hash") or ""

    submitted_hash = _sha256(flag)
    correct = bool(expected_hash and submitted_hash == expected_hash.lower())

    activity = frappe.new_doc("Lab Activity")
    activity.student = student
    activity.lab_id = lab_id
    activity.action = "Flag Attempt"
    activity.flag_submitted = flag if not correct else "***REDACTED***"
    activity.success = 1 if correct else 0
    activity.timestamp = datetime.utcnow()
    activity.save(ignore_permissions=True)
    frappe.db.commit()

    return {"correct": correct}


# ── Status queries (called by student via frappe-proxy) ─────────────────────────

@frappe.whitelist()
def get_lab_status(lab_id: str):
    """
    Returns the current active container record for the calling student.
    Returns {} if no active lab exists.
    """
    student = frappe.session.user
    if student == "Guest":
        frappe.throw(_("Authentication required"), frappe.AuthenticationError)

    record = frappe.db.get_value(
        "Student Lab",
        {"student": student, "lab_id": lab_id, "status": ["in", ["Active", "Provisioning"]]},
        ["name", "container_name", "status", "connection_url", "expires_at"],
        as_dict=True,
    )
    return record or {}


@frappe.whitelist()
def get_student_lab_history(lab_id: str = None):
    """
    Returns the calling student's Lab Activity log, newest first.
    Optionally filtered to a single lab_id.
    """
    student = frappe.session.user
    if student == "Guest":
        frappe.throw(_("Authentication required"), frappe.AuthenticationError)

    filters = {"student": student}
    if lab_id:
        filters["lab_id"] = lab_id

    records = frappe.get_all(
        "Lab Activity",
        filters=filters,
        fields=["lab_id", "action", "success", "timestamp", "container_name"],
        order_by="timestamp desc",
        limit=50,
    )
    return records
