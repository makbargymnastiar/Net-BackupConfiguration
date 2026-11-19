"""
Oxidized API routes - Oxidized integration endpoints.
"""

import difflib
from datetime import datetime, timezone
from flask import request, jsonify
from routes import oxidized_api_bp
from routes.auth import login_required, admin_required
from services.oxidized_service import (
    get_oxidized_node_status,
    get_oxidized_nodes_status,
    get_oxidized_config,
    get_oxidized_version_history,
    get_oxidized_version_config,
    trigger_oxidized_backup,
    is_valid_oxidized_config,
    read_oxidized_interval,
    write_oxidized_interval,
    format_interval,
    get_oxidized_info,
)
from services.docker_service import restart_oxidized_container
from models.node import Node
from services import activity_log_service
import requests
import os

# Configuration (will be set by app.py)
OXIDIZED_API_URL = os.getenv("OXIDIZED_API_URL", "http://oxidized:8888")
OXIDIZED_CONFIG_FILE = "/oxidized_config/config"


def set_config(oxidized_url, oxidized_config_file):
    """Set configuration from app.py."""
    global OXIDIZED_API_URL, OXIDIZED_CONFIG_FILE
    OXIDIZED_API_URL = oxidized_url
    OXIDIZED_CONFIG_FILE = oxidized_config_file


def _status_entries(status_data):
    """Yield (name, payload) pairs for either supported Oxidized status shape."""
    if isinstance(status_data, list):
        for item in status_data:
            if isinstance(item, dict):
                name = item.get("name") or item.get("full_name")
                if name:
                    yield name, item
    elif isinstance(status_data, dict):
        if status_data.get("name") or status_data.get("full_name"):
            yield status_data.get("name") or status_data.get("full_name"), status_data
        else:
            for name, item in status_data.items():
                if isinstance(item, dict):
                    yield name, item


def _normalize_backup_time(value):
    if isinstance(value, dict):
        value = value.get("end")
    if not value:
        return None
    value = str(value).strip()
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat(timespec="seconds")
    except ValueError:
        return None


def _record_scheduled_backup_results(status_data):
    """Validate newly completed Oxidized runs and persist their final outcomes."""
    for node_name, payload in _status_entries(status_data):
        node = Node.get_by_name(node_name)
        if not node:
            continue

        stats = payload.get("stats") or {}
        last_data = stats.get("last") or payload.get("last") or {}
        completed_at = _normalize_backup_time(last_data)
        status_value = payload.get("status") or stats.get("status")
        if not status_value and isinstance(last_data, dict):
            status_value = last_data.get("status", "")
        status_value = str(status_value or "").lower()

        if completed_at and completed_at != _normalize_backup_time(node.last_backup):
            config = get_oxidized_config(node_name)
            final_status = (
                "SUCCESS" if is_valid_oxidized_config(config) else "FAILED"
            )
            previous_backup = _normalize_backup_time(node.last_backup)
            previous_status = node.last_status
            node.last_backup = completed_at
            node.last_status = final_status.lower()
            node.save()

            # A manual trigger records its completion locally before the next
            # Oxidized poll. Reconcile that timestamp without duplicating its log.
            previous_dt = None
            current_dt = None
            for raw, target in ((previous_backup, "previous"), (completed_at, "current")):
                try:
                    parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                    if parsed.tzinfo is None:
                        parsed = parsed.replace(tzinfo=timezone.utc)
                    if target == "previous":
                        previous_dt = parsed
                    else:
                        current_dt = parsed
                except (AttributeError, ValueError):
                    pass
            is_recent_manual_result = (
                previous_dt is not None
                and current_dt is not None
                and abs((current_dt - previous_dt).total_seconds()) <= 120
                and previous_status == final_status.lower()
            )
            if not is_recent_manual_result:
                activity_log_service.append_entry(
                    node_name,
                    node.ip,
                    final_status,
                    timestamp=completed_at,
                )
            payload["status"] = node.last_status
            continue

        error_text = " ".join(
            str(source.get(key) or "")
            for source in (payload, stats, last_data if isinstance(last_data, dict) else {})
            for key in ("error", "exception", "message")
        ).lower()
        has_error_message = any(
            marker in error_text
            for marker in (
                "node not found",
                "connection refused",
                "timed out",
                "timeout",
                "authentication failed",
                "auth failed",
                "failed to connect",
            )
        )
        has_failed_status = status_value in {"failed", "error", "failure"} or any(
            marker in status_value
            for marker in ("authentication_error", "connection_error", "timeout")
        )
        if (
            has_failed_status or has_error_message
        ) and node.last_status != "failed":
            node.last_status = "failed"
            node.save()
            activity_log_service.append_entry(
                node_name, node.ip, "FAILED"
            )
        elif status_value in {"success", "successful"} and node.last_status != "success":
            config = get_oxidized_config(node_name)
            node.last_status = (
                "success" if is_valid_oxidized_config(config) else "failed"
            )
            node.save()
            activity_log_service.append_entry(
                node_name,
                node.ip,
                "SUCCESS" if node.last_status == "success" else "FAILED",
            )
        elif not node.last_backup and status_value in {"", "pending", "no_connection"}:
            node.last_status = "no_connection"
            node.save()

        if node.last_status in {"success", "failed", "no_connection"}:
            payload["status"] = node.last_status


@oxidized_api_bp.route("/api/oxidized/status", methods=["GET"])
def oxidized_status():
    """Get all nodes Oxidized status."""
    status = get_oxidized_nodes_status()
    _record_scheduled_backup_results(status)
    return jsonify(status)


@oxidized_api_bp.route("/api/oxidized/info", methods=["GET"])
def oxidized_info():
    """Get Oxidized global config info."""
    info = get_oxidized_info()
    return jsonify(info)


@oxidized_api_bp.route("/api/oxidized/interval", methods=["GET"])
def oxidized_get_interval():
    """Get current backup interval in minutes."""
    seconds = read_oxidized_interval()
    return jsonify({"interval_seconds": seconds, "interval_minutes": seconds // 60})


@oxidized_api_bp.route("/api/oxidized/interval", methods=["PUT", "POST"])
def oxidized_set_interval():
    """Set backup interval."""
    data = request.json
    minutes = data.get("minutes")

    if not minutes:
        return jsonify({"success": False, "error": "minutes is required"}), 400

    try:
        minutes = int(minutes)
        if minutes < 1 or minutes > 10080:
            return jsonify(
                {"success": False, "error": "minutes must be between 1 and 10080"}
            ), 400
    except ValueError:
        return jsonify(
            {"success": False, "error": "minutes must be a valid integer"}
        ), 400

    seconds = minutes * 60
    if write_oxidized_interval(seconds):
        # Config changes require container restart
        restart_oxidized_container()
        return jsonify(
            {"success": True, "interval_seconds": seconds, "interval_minutes": minutes}
        )

    return jsonify({"success": False, "error": "Failed to write config"}), 500


@oxidized_api_bp.route("/api/oxidized/node/<node_name>/status", methods=["GET"])
def oxidized_node_status(node_name):
    """Get single node Oxidized status."""
    status = get_oxidized_node_status(node_name)
    if status:
        return jsonify(status)
    return jsonify({"error": "Node not found in Oxidized"}), 404


@oxidized_api_bp.route("/api/oxidized/node/<node_name>/config", methods=["GET"])
def oxidized_node_config(node_name):
    """Get node current config."""
    config = get_oxidized_config(node_name)
    if is_valid_oxidized_config(config):
        return jsonify({"config": config})
    return jsonify({"error": "Failed to get a valid configuration"}), 502


@oxidized_api_bp.route("/api/oxidized/node/<node_name>/history", methods=["GET"])
def oxidized_node_history(node_name):
    """Get node version history."""
    history = get_oxidized_version_history(node_name)
    return jsonify(history)


@oxidized_api_bp.route(
    "/api/oxidized/node/<node_name>/history/<int:version_num>", methods=["GET"]
)
def oxidized_node_version_config(node_name, version_num):
    """Get node specific version config by integer version number."""
    config = get_oxidized_version_config(node_name, version_num)
    if is_valid_oxidized_config(config):
        return jsonify({"config": config})
    return jsonify({"error": "Failed to get version config"}), 404


@oxidized_api_bp.route(
    "/api/oxidized/node/<node_name>/version", methods=["GET"]
)
def oxidized_node_version_by_oid(node_name):
    """Get node specific version config by oid (git commit hash).

    Query params:
        oid: git commit oid (required)
        epoch: Unix timestamp in seconds (optional). If the oid doesn't exist in
              git (Oxidized cache bug), this timestamp is used to find the
              correct commit. Accepts both numeric strings and ISO date strings.
    """
    oid = request.args.get("oid")
    epoch_raw = request.args.get("epoch")
    if not oid:
        return jsonify({"error": "Missing required parameter: oid"}), 400

    # Normalize epoch to Unix timestamp seconds (int)
    epoch = None
    if epoch_raw:
        try:
            # Try as numeric string first
            epoch = int(epoch_raw)
        except ValueError:
            # Fallback: try parsing as ISO date string
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(epoch_raw.replace(" +0000", "+00:00"))
                epoch = int(dt.timestamp())
            except Exception:
                pass

    config = get_oxidized_version_config(node_name, oid, epoch)
    if is_valid_oxidized_config(config):
        return jsonify({"config": config})
    return jsonify({"error": "Failed to get version config"}), 404


@oxidized_api_bp.route("/api/oxidized/node/<node_name>/backup", methods=["POST"])
def oxidized_node_backup(node_name):
    """Trigger immediate backup."""
    node = Node.get_by_name(node_name)
    if not node:
        return jsonify({"success": False, "error": "Backup failed"}), 404

    result = trigger_oxidized_backup(node_name)
    if not result.get("success"):
        node.last_status = "failed"
        node.save()
        return jsonify({"success": False, "error": "Backup failed"}), 500

    from datetime import datetime, timezone

    node.last_status = "success"
    node.last_backup = datetime.now(timezone.utc).isoformat(timespec="seconds")
    node.save()
    return jsonify({"success": True})


@oxidized_api_bp.route(
    "/api/oxidized/node/<node_name>/diff", methods=["GET"]
)
def oxidized_node_diff(node_name):
    """Get diff between two versions - returns aligned line data for split-pane view."""
    oid1 = request.args.get("oid1")
    oid2 = request.args.get("oid2")
    epoch1 = request.args.get("epoch1")
    epoch2 = request.args.get("epoch2")

    if not oid1 or not oid2:
        return jsonify({"error": "Missing oid parameters"}), 400

    config1 = get_oxidized_version_config(node_name, oid1, epoch1)
    config2 = get_oxidized_version_config(node_name, oid2, epoch2)
    if config1 is None or config2 is None:
        return jsonify({"error": "Failed to get version configs"}), 404

    lines1 = config1.splitlines()
    lines2 = config2.splitlines()

    # Use difflib to generate aligned diff
    matcher = difflib.SequenceMatcher(None, lines1, lines2)
    aligned_lines = []

    old_line_num = 0
    new_line_num = 0

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                old_line_num += 1
                new_line_num += 1
                aligned_lines.append({
                    "type": "equal",
                    "old_line": old_line_num,
                    "new_line": new_line_num,
                    "old_content": lines1[i1 + k],
                    "new_content": lines2[j1 + k]
                })
        elif tag == 'replace':
            for k in range(i2 - i1):
                old_line_num += 1
                aligned_lines.append({
                    "type": "delete",
                    "old_line": old_line_num,
                    "new_line": None,
                    "old_content": lines1[i1 + k],
                    "new_content": ""
                })
            for k in range(j2 - j1):
                new_line_num += 1
                aligned_lines.append({
                    "type": "insert",
                    "old_line": None,
                    "new_line": new_line_num,
                    "old_content": "",
                    "new_content": lines2[j1 + k]
                })
        elif tag == 'delete':
            for k in range(i2 - i1):
                old_line_num += 1
                aligned_lines.append({
                    "type": "delete",
                    "old_line": old_line_num,
                    "new_line": None,
                    "old_content": lines1[i1 + k],
                    "new_content": ""
                })
        elif tag == 'insert':
            for k in range(j2 - j1):
                new_line_num += 1
                aligned_lines.append({
                    "type": "insert",
                    "old_line": None,
                    "new_line": new_line_num,
                    "old_content": "",
                    "new_content": lines2[j1 + k]
                })

    return jsonify({
        "aligned_lines": aligned_lines,
        "stats": {
            "equal": sum(1 for l in aligned_lines if l["type"] == "equal"),
            "insert": sum(1 for l in aligned_lines if l["type"] == "insert"),
            "delete": sum(1 for l in aligned_lines if l["type"] == "delete"),
        }
    })


@oxidized_api_bp.route("/api/oxidized/restart", methods=["POST"])
@admin_required
def oxidized_restart():
    """Restart Oxidized container to reload config."""
    from services.docker_service import restart_oxidized_container

    success = restart_oxidized_container()
    if success:
        return jsonify({"success": True, "message": "Oxidized container restarted"})
    return jsonify({"success": False, "error": "Restart failed, please check container status"}), 500


@oxidized_api_bp.route("/api/oxidized/token", methods=["GET"])
def oxidized_get_token():
    """Get Oxidized API token (masked for security)."""
    from database import get_config_setting
    token = get_config_setting("oxidized_api_token", "")
    # Return masked token for security
    masked = token[:8] + "..." + token[-4:] if len(token) > 12 else "****" if token else ""
    return jsonify({
        "has_token": bool(token),
        "token_masked": masked
    })


@oxidized_api_bp.route("/api/oxidized/token", methods=["PUT", "POST"])
@admin_required
def oxidized_set_token():
    """Set Oxidized API token."""
    from database import set_config_setting
    import services.oxidized_service as oxidized_service

    data = request.json
    token = data.get("token", "").strip() if data else ""

    # Save to database
    set_config_setting("oxidized_api_token", token, "oxidized")

    # Update oxidized_service with new token
    oxidized_service.set_config(OXIDIZED_API_URL, OXIDIZED_CONFIG_FILE, token)

    return jsonify({
        "success": True,
        "has_token": bool(token),
        "token_masked": token[:8] + "..." + token[-4:] if len(token) > 12 else "****" if token else ""
    })
