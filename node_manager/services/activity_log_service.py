"""
Activity Log service - persists UI backup outcomes to a plain-text file.

The boss requires the Activity Log to survive in a real file on the server
(not just browser localStorage). We keep it dead simple: one line per event,
pipe-delimited, no database schema. Location defaults to the same directory as
nodes.csv / nodes.db so it shares the writable config volume.

Line format (newest appended at the bottom):
    2026-11-04T14:23:05 | core-rtr-01 | 10.10.1.5 | SUCCESS | +12 -23
    2026-11-04T14:30:11 | edge-sw-02  | 10.10.2.7 | FAILED  | -

Only final outcomes (SUCCESS / FAILED) are written; the browser shows a
pending entry first and only POSTs once the backup result is known.
"""

import os
from datetime import datetime

# Configurable via env, same style as CONFIG_FILE / DATABASE_PATH.
ACTIVITY_LOG_FILE = os.getenv("ACTIVITY_LOG_FILE", "/oxidized_config/activity_log.txt")

# Simple size guard so the file can't grow without bound. When exceeded we
# trim from the top (oldest lines) down to MAX_LINES.
MAX_LINES = int(os.getenv("ACTIVITY_LOG_MAX_LINES", "5000"))


def set_config(activity_log_file):
    """Set configuration from app.py."""
    global ACTIVITY_LOG_FILE
    ACTIVITY_LOG_FILE = activity_log_file


def _format_diff(status, insert, delete):
    """Render the trailing diff field for a log line."""
    if status != "SUCCESS":
        # Failed backups have no meaningful diff.
        return "-"
    ins = insert or 0
    dele = delete or 0
    if ins == 0 and dele == 0:
        return "no change"
    return f"+{ins} -{dele}"


def _parse_diff(diff_field):
    """Inverse of _format_diff -> (insert, delete) as ints or None."""
    field = (diff_field or "").strip()
    if field in ("", "-", "no change"):
        if field == "no change":
            return 0, 0
        return None, None
    insert = None
    delete = None
    for token in field.split():
        if token.startswith("+"):
            try:
                insert = int(token[1:])
            except ValueError:
                pass
        elif token.startswith("-"):
            try:
                delete = int(token[1:])
            except ValueError:
                pass
    return insert, delete


def append_entry(name, ip="", status="SUCCESS", insert=None, delete=None, timestamp=None, message=None):
    """Append one activity-log line to the text file. Returns the parsed entry.

    `message` is an optional human-readable label (e.g. "Node updated
    successfully") stored as a trailing 6th field so non-backup events can
    reuse the same log/panel. When absent the line keeps the original 5-field
    backup format.
    """
    status = (status or "").upper()
    if status not in ("SUCCESS", "FAILED"):
        raise ValueError("status must be SUCCESS or FAILED")

    ts = timestamp or datetime.now().isoformat(timespec="seconds")
    # Normalise the timestamp to a single line and strip the pipe separator so
    # a crafted value can't inject fake log rows.
    ts = str(ts).replace("\n", " ").replace("\r", " ")
    safe_name = str(name or "").replace("|", "/").replace("\n", " ").strip()
    safe_ip = str(ip or "").replace("|", "/").replace("\n", " ").strip()
    safe_message = (
        str(message or "").replace("|", "/").replace("\n", " ").replace("\r", " ").strip()
    )

    diff = _format_diff(status, insert, delete)
    if safe_message:
        line = f"{ts} | {safe_name} | {safe_ip} | {status} | {diff} | {safe_message}"
    else:
        line = f"{ts} | {safe_name} | {safe_ip} | {status} | {diff}"

    directory = os.path.dirname(ACTIVITY_LOG_FILE)
    if directory:
        os.makedirs(directory, exist_ok=True)
    with open(ACTIVITY_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")

    _trim_if_needed()

    ins, dele = _parse_diff(diff)
    return {
        "timestamp": ts,
        "name": safe_name,
        "ip": safe_ip,
        "status": status,
        "insert": ins,
        "delete": dele,
        "message": safe_message or None,
    }


def _trim_if_needed():
    """Keep the file bounded to MAX_LINES by dropping the oldest rows."""
    try:
        with open(ACTIVITY_LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return
    if len(lines) > MAX_LINES:
        lines = lines[-MAX_LINES:]
        with open(ACTIVITY_LOG_FILE, "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")


def read_entries(limit=200):
    """Return the most recent entries, newest first, as parsed dicts."""
    try:
        with open(ACTIVITY_LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.read().splitlines()
    except FileNotFoundError:
        return []

    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 200
    if limit <= 0:
        limit = 200

    recent = lines[-limit:] if lines else []
    recent.reverse()  # newest first for the panel

    entries = []
    for line in recent:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 4:
            continue
        ts = parts[0]
        name = parts[1]
        ip = parts[2] if len(parts) > 2 else ""
        status = (parts[3] if len(parts) > 3 else "").upper()
        diff_field = parts[4] if len(parts) > 4 else ""
        message = parts[5] if len(parts) > 5 else ""
        ins, dele = _parse_diff(diff_field)
        entries.append(
            {
                "timestamp": ts,
                "name": name,
                "ip": ip,
                "status": status,
                "insert": ins,
                "delete": dele,
                "message": message or None,
            }
        )
    return entries
