"""
Tests for the Activity Log text-file service and its HTTP endpoints.
"""


# ============ Service (plain-text store) ============
def test_service_append_and_read_roundtrip(tmp_path, monkeypatch):
    from services import activity_log_service as s

    log_file = tmp_path / "activity_log.txt"
    monkeypatch.setattr(s, "ACTIVITY_LOG_FILE", str(log_file))

    s.append_entry(
        "core-rtr-01", "10.1.1.1", "SUCCESS", insert=12, delete=23,
        timestamp="2026-11-04T14:23:05",
    )
    s.append_entry("edge-sw-02", "10.1.1.2", "FAILED")
    s.append_entry("no-ch-03", "10.1.1.3", "SUCCESS", insert=0, delete=0)

    # File format is exactly the pipe-delimited spec.
    lines = log_file.read_text(encoding="utf-8").splitlines()
    assert lines[0] == "2026-11-04T14:23:05 | core-rtr-01 | 10.1.1.1 | SUCCESS | +12 -23"
    assert lines[1].endswith("| edge-sw-02 | 10.1.1.2 | FAILED | -")
    assert lines[2].endswith("| no-ch-03 | 10.1.1.3 | SUCCESS | no change")

    entries = s.read_entries(limit=10)
    # Newest first.
    assert entries[0]["name"] == "no-ch-03"
    assert entries[0]["insert"] == 0 and entries[0]["delete"] == 0
    assert entries[1]["status"] == "FAILED"
    assert entries[1]["insert"] is None
    assert entries[2]["name"] == "core-rtr-01"
    assert entries[2]["insert"] == 12 and entries[2]["delete"] == 23


def test_service_rejects_pipe_injection(tmp_path, monkeypatch):
    from services import activity_log_service as s

    log_file = tmp_path / "activity_log.txt"
    monkeypatch.setattr(s, "ACTIVITY_LOG_FILE", str(log_file))

    s.append_entry("evil|name", "1.2.3.4", "SUCCESS", insert=1, delete=0)
    entry = s.read_entries(limit=1)[0]
    # The pipe in the name is neutralised so it can't fake a new column.
    assert entry["name"] == "evil/name"
    assert entry["ip"] == "1.2.3.4"
    assert entry["status"] == "SUCCESS"


def test_service_read_missing_file_returns_empty(tmp_path, monkeypatch):
    from services import activity_log_service as s

    monkeypatch.setattr(s, "ACTIVITY_LOG_FILE", str(tmp_path / "nope.txt"))
    assert s.read_entries(limit=50) == []


# ============ HTTP endpoints ============
def test_post_requires_login(client):
    resp = client.post(
        "/api/activity-log", json={"name": "n1", "status": "SUCCESS"}
    )
    # Unauthenticated requests are redirected to the login page.
    assert resp.status_code == 302


def test_post_validation_and_get(test_client_with_auth, tmp_path, monkeypatch):
    from services import activity_log_service as s

    monkeypatch.setattr(s, "ACTIVITY_LOG_FILE", str(tmp_path / "activity_log.txt"))

    # Missing name -> 400
    resp = test_client_with_auth.post("/api/activity-log", json={"status": "SUCCESS"})
    assert resp.status_code == 400

    # Bad status -> 400
    resp = test_client_with_auth.post(
        "/api/activity-log", json={"name": "n1", "status": "MAYBE"}
    )
    assert resp.status_code == 400

    # Valid success -> stored
    resp = test_client_with_auth.post(
        "/api/activity-log",
        json={"name": "n1", "ip": "10.0.0.1", "status": "SUCCESS", "insert": 5, "delete": 2},
    )
    assert resp.status_code == 200
    assert resp.get_json()["success"] is True

    resp = test_client_with_auth.get("/api/activity-log")
    assert resp.status_code == 200
    entries = resp.get_json()["entries"]
    assert len(entries) == 1
    assert entries[0]["name"] == "n1"
    assert entries[0]["insert"] == 5 and entries[0]["delete"] == 2
