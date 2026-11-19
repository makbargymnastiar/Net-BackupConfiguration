"""
Activity Log API routes - persist / read the UI backup outcome log.

Backed by a plain-text file (services/activity_log_service.py), not the
database. The dashboard POSTs one event when a backup reaches a final
SUCCESS/FAILED state and GETs the recent entries to render the panel, so the
log survives a reload and is shared across browsers/sessions.
"""
from flask import Blueprint, request, jsonify
from routes.auth import login_required
from services import activity_log_service

activity_log_bp = Blueprint("activity_log", __name__)


@activity_log_bp.route("/api/activity-log", methods=["POST"])
@login_required
def create_activity_log_entry():
    """Append one final backup outcome to the text log."""
    data = request.get_json(silent=True) or {}

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"success": False, "error": "name is required"}), 400

    status = (data.get("status") or "").upper()
    if status not in ("SUCCESS", "FAILED"):
        return jsonify({"success": False, "error": "status must be SUCCESS or FAILED"}), 400

    ip = (data.get("ip") or "").strip()

    def _as_int(v):
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    insert = _as_int(data.get("added", data.get("insert")))
    delete = _as_int(data.get("removed", data.get("delete")))
    changed = _as_int(data.get("changed"))
    timestamp = data.get("timestamp")
    message = (data.get("message") or "").strip()

    try:
        entry = activity_log_service.append_entry(
            name=name,
            ip=ip,
            status=status,
            insert=insert,
            delete=delete,
            changed=changed,
            timestamp=timestamp,
            message=message or None,
        )
    except Exception as e:  # disk/permission problems shouldn't crash the UI
        return jsonify({"success": False, "error": f"Failed to write activity log: {e}"}), 500

    return jsonify({"success": True, "entry": entry})


@activity_log_bp.route("/api/activity-log", methods=["GET"])
@login_required
def get_activity_log_entries():
    """Return recent activity-log entries, newest first."""
    limit = request.args.get("limit", default=200, type=int)
    entries = activity_log_service.read_entries(limit=limit)
    return jsonify({"entries": entries})
