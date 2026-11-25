"""Tests for validating manual and Oxidized-scheduled backup results."""

from models.node import Node
from services import activity_log_service, oxidized_service


def _create_node(name="edge-router"):
    return Node(
        name=name,
        ip="192.0.2.10",
        model="ios",
        username="test",
        password="test",
    ).save()


def test_oxidized_config_validator_rejects_empty_and_error_responses():
    assert not oxidized_service.is_valid_oxidized_config("")
    assert not oxidized_service.is_valid_oxidized_config("Node not found")
    assert not oxidized_service.is_valid_oxidized_config("Connection refused")
    assert oxidized_service.is_valid_oxidized_config("hostname edge-router\n")


def test_http_200_without_valid_config_is_not_a_success(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"name": "edge-router"}

    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service,
        "get_oxidized_config",
        lambda _name: "Connection refused",
    )
    monkeypatch.setattr(oxidized_service, "get_oxidized_version_history", lambda _name: [])
    monkeypatch.setattr(
        oxidized_service, "get_oxidized_node_status", lambda _name, **_kwargs: None
    )
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_ATTEMPTS", 1)

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result["success"] is False


def test_manual_backup_waits_for_new_oxidized_completion_time(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"name": "edge-router"}

    statuses = iter(
        [
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "success"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "success"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:01Z", "status": "success"}}},
        ]
    )
    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service,
        "get_oxidized_node_status",
        lambda _name, **_kwargs: next(statuses),
    )
    monkeypatch.setattr(
        oxidized_service, "get_oxidized_config", lambda _name: "hostname edge-router\n"
    )
    monkeypatch.setattr(oxidized_service.time, "sleep", lambda *_args: None)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_ATTEMPTS", 3)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_INTERVAL_SECONDS", 1)

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result == {
        "success": True,
        "status": "success",
        "last_backup": "2026-01-01T00:00:01+00:00",
    }


def test_manual_backup_accepts_updated_completion_time(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"name": "edge-router"}

    statuses = iter(
        [
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "success"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:01Z", "status": "success"}}},
        ]
    )
    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service,
        "get_oxidized_node_status",
        lambda _name, **_kwargs: next(statuses),
    )
    monkeypatch.setattr(
        oxidized_service, "get_oxidized_config", lambda _name: "hostname edge-router\n"
    )
    monkeypatch.setattr(oxidized_service.time, "sleep", lambda *_args: None)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_ATTEMPTS", 1)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_INTERVAL_SECONDS", 1)

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result == {
        "success": True,
        "status": "success",
        "last_backup": "2026-01-01T00:00:01+00:00",
    }


def test_manual_backup_reports_new_oxidized_failure_status(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {}

    statuses = iter(
        [
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "success"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:01Z", "status": "no_connection"}}},
        ]
    )
    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service,
        "get_oxidized_node_status",
        lambda _name, **_kwargs: next(statuses),
    )
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_ATTEMPTS", 2)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_INTERVAL_SECONDS", 1)

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result["success"] is False
    assert result["status"] == "failed"
    assert result["last_backup"] == "2026-01-01T00:00:01+00:00"
    assert "no_connection" in result["error"]


def test_manual_backup_waits_for_new_end_before_using_failure_status(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {}

    statuses = iter(
        [
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "success"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "no_connection"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:01Z", "status": "no_connection"}}},
        ]
    )
    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service,
        "get_oxidized_node_status",
        lambda _name, **_kwargs: next(statuses),
    )
    monkeypatch.setattr(oxidized_service.time, "sleep", lambda *_args: None)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_ATTEMPTS", 2)

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result["success"] is False
    assert result["status"] == "failed"
    assert result["last_backup"] == "2026-01-01T00:00:01+00:00"
    assert "no_connection" in result["error"]


def test_manual_backup_timeout_returns_snapshot_time_for_consistency(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {}

    statuses = iter(
        [
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "success"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "no_connection"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z", "status": "no_connection"}}},
        ]
    )
    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service,
        "get_oxidized_node_status",
        lambda _name, **_kwargs: next(statuses),
    )
    monkeypatch.setattr(oxidized_service.time, "sleep", lambda *_args: None)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_ATTEMPTS", 2)

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result["success"] is False
    assert result["status"] == "failed"
    assert result["last_backup"] == "2026-01-01T00:00:00+00:00"


def test_manual_backup_failure_is_persisted(test_client_with_auth, monkeypatch, tmp_path):
    node = _create_node()
    monkeypatch.setattr(
        activity_log_service, "ACTIVITY_LOG_FILE", str(tmp_path / "activity.log")
    )
    monkeypatch.setattr(
        "routes.oxidized_api.trigger_oxidized_backup",
        lambda _name: {"success": False, "error": "connection refused"},
    )

    response = test_client_with_auth.post(
        f"/api/oxidized/node/{node.name}/backup"
    )

    assert response.status_code == 500
    assert response.json["success"] is False
    assert response.json["status"] == "failed"
    assert Node.get_by_name(node.name).last_status == "failed"
    assert response.json["activity_entry"]["status"] == "FAILED"


def test_manual_backup_success_requires_valid_configuration(
    test_client_with_auth, monkeypatch, tmp_path
):
    node = _create_node()
    monkeypatch.setattr(
        activity_log_service, "ACTIVITY_LOG_FILE", str(tmp_path / "activity.log")
    )
    monkeypatch.setattr(
        "routes.oxidized_api._latest_backup_diff_stats",
        lambda _name: {"added": 1, "removed": 0, "changed": 0},
    )
    monkeypatch.setattr(
        "routes.oxidized_api.trigger_oxidized_backup",
        lambda _name: {
            "success": True,
            "status": "success",
            "last_backup": "2026-11-19T10:00:00+00:00",
        },
    )

    response = test_client_with_auth.post(
        f"/api/oxidized/node/{node.name}/backup"
    )

    assert response.status_code == 200
    assert response.json["success"] is True
    assert response.json["status"] == "success"
    assert response.json["activity_entry"]["added"] == 1
    saved_node = Node.get_by_name(node.name)
    assert saved_node.last_status == "success"
    assert saved_node.last_backup == "2026-11-19T10:00:00+00:00"


def test_scheduled_backup_result_is_validated_and_logged(
    test_client_with_auth, monkeypatch, tmp_path
):
    node = _create_node()
    activity_log = tmp_path / "activity.log"
    monkeypatch.setattr(
        activity_log_service, "ACTIVITY_LOG_FILE", str(activity_log)
    )
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_nodes_status",
        lambda: [
            {
                "name": node.name,
                "stats": {
                    "last": {
                        "end": "2026-11-19T04:00:00Z",
                        "status": "success",
                    }
                },
            }
        ],
    )
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_config",
        lambda _name: "hostname edge-router\n",
    )

    response = test_client_with_auth.get("/api/oxidized/status")

    assert response.status_code == 200
    assert response.json[0]["status"] == "success"
    assert Node.get_by_name(node.name).last_status == "success"
    assert "SUCCESS" in activity_log.read_text(encoding="utf-8")


def test_scheduled_backup_with_empty_config_is_logged_as_failed(
    test_client_with_auth, monkeypatch, tmp_path
):
    node = _create_node()
    activity_log = tmp_path / "activity.log"
    monkeypatch.setattr(
        activity_log_service, "ACTIVITY_LOG_FILE", str(activity_log)
    )
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_nodes_status",
        lambda: [
            {
                "name": node.name,
                "stats": {
                    "last": {
                        "end": "2026-11-19T04:01:00Z",
                        "status": "success",
                    }
                },
            }
        ],
    )
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_config",
        lambda _name: "",
    )

    response = test_client_with_auth.get("/api/oxidized/status")

    assert response.status_code == 200
    assert response.json[0]["status"] == "failed"
    assert Node.get_by_name(node.name).last_status == "failed"
    assert "FAILED" in activity_log.read_text(encoding="utf-8")


def test_status_refresh_preserves_manual_failure_without_new_completion(
    test_client_with_auth, monkeypatch
):
    node = _create_node()
    node.last_backup = "2026-11-19T04:00:00+00:00"
    node.last_status = "failed"
    node.save()
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_nodes_status",
        lambda: [
            {
                "name": node.name,
                "stats": {
                    "last": {
                        "end": "2026-11-19T04:00:00Z",
                        "status": "success",
                    }
                },
            }
        ],
    )
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_config",
        lambda _name: "hostname edge-router\n",
    )

    response = test_client_with_auth.get("/api/oxidized/status")

    assert response.status_code == 200
    assert response.json[0]["status"] == "failed"
    assert Node.get_by_name(node.name).last_status == "failed"


def test_status_refresh_preserves_manual_timeout_without_any_completion(
    test_client_with_auth, monkeypatch
):
    node = _create_node()
    node.last_status = "failed"
    node.save()
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_nodes_status",
        lambda: [
            {
                "name": node.name,
                "status": "success",
                "stats": {"last": {"status": "success"}},
            }
        ],
    )
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_config",
        lambda _name: "hostname edge-router\n",
    )

    response = test_client_with_auth.get("/api/oxidized/status")

    assert response.status_code == 200
    assert response.json[0]["status"] == "failed"
    assert Node.get_by_name(node.name).last_status == "failed"


def test_diff_normalizes_empty_and_iso_epochs(test_client_with_auth, monkeypatch):
    received_epochs = []

    def get_version_config(_node_name, _oid, epoch=None):
        received_epochs.append(epoch)
        return "hostname edge-router\n"

    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_version_config", get_version_config
    )

    response = test_client_with_auth.get(
        "/api/oxidized/node/edge-router/diff"
        "?oid1=first&oid2=second&epoch1=&epoch2=2026-01-02T03:04:05Z"
    )

    assert response.status_code == 200
    assert received_epochs == [None, 1767323045]


def test_compare_groups_replacements_as_modified_and_keeps_rows_aligned():
    from routes.oxidized_api import _compare_configurations

    lines, stats = _compare_configurations(
        "first\nold setting\nmiddle\nold extra\nlast\n",
        "first\nnew setting\nmiddle\nnew extra\nlast\nadded\n",
    )

    assert stats == {
        "same": 3,
        "added": 1,
        "removed": 0,
        "changed": 2,
        "equal": 3,
        "insert": 1,
        "delete": 0,
    }
    assert [line["type"] for line in lines] == [
        "equal",
        "modified",
        "equal",
        "modified",
        "equal",
        "insert",
    ]
    assert lines[1]["old_content"] == "old setting"
    assert lines[1]["new_content"] == "new setting"
    assert (lines[1]["old_line"], lines[1]["new_line"]) == (2, 2)
    assert (lines[5]["old_line"], lines[5]["new_line"]) == (None, 6)


def test_compare_classifies_unpaired_replacement_lines_as_additions_and_removals():
    from routes.oxidized_api import _compare_configurations

    lines, stats = _compare_configurations(
        "first\nold setting\nold extra\nlast\n",
        "first\nnew setting\nnew extra\nnewer extra\nlast\n",
    )

    assert stats["same"] == 2
    assert stats["changed"] == 2
    assert stats["added"] == 1
    assert stats["removed"] == 0
    assert [line["type"] for line in lines] == [
        "equal",
        "modified",
        "modified",
        "insert",
        "equal",
    ]
    assert (lines[3]["old_line"], lines[3]["new_line"]) == (None, 4)


def test_compare_delete_rows_include_same_height_placeholder_data():
    from routes.oxidized_api import _compare_configurations

    lines, stats = _compare_configurations(
        "first\nremoved one\nremoved two\nlast\n",
        "first\nlast\n",
    )

    assert stats["removed"] == 2
    assert [line["type"] for line in lines] == [
        "equal",
        "delete",
        "delete",
        "equal",
    ]
    assert all(
        line["old_line"] is not None
        and line["new_line"] is None
        and line["new_content"] == ""
        for line in lines[1:3]
    )


def test_activity_log_exposes_new_counts_and_parses_legacy_lines(tmp_path, monkeypatch):
    from services import activity_log_service

    log_path = tmp_path / "activity.log"
    monkeypatch.setattr(activity_log_service, "ACTIVITY_LOG_FILE", str(log_path))
    log_path.write_text(
        "2026-11-18T10:00:00 | old-device | 192.0.2.1 | SUCCESS | +2 -1\n",
        encoding="utf-8",
    )

    activity_log_service.append_entry(
        "router",
        "192.0.2.2",
        "SUCCESS",
        insert=1,
        delete=2,
        changed=3,
        timestamp="2026-11-19T10:00:00",
    )

    entries = activity_log_service.read_entries()
    assert entries[0]["added"] == entries[0]["insert"] == 1
    assert entries[0]["removed"] == entries[0]["delete"] == 2
    assert entries[0]["changed"] == 3
    assert entries[1]["added"] == entries[1]["insert"] == 2
    assert entries[1]["removed"] == entries[1]["delete"] == 1
    assert entries[1]["changed"] is None


def test_activity_log_parses_failed_and_no_change_entries(tmp_path, monkeypatch):
    from services import activity_log_service

    log_path = tmp_path / "activity.log"
    monkeypatch.setattr(activity_log_service, "ACTIVITY_LOG_FILE", str(log_path))
    activity_log_service.append_entry("failed-device", status="FAILED")
    activity_log_service.append_entry("unchanged-device", status="SUCCESS", insert=0, delete=0)

    entries = activity_log_service.read_entries()
    assert entries[0]["added"] == entries[0]["removed"] == entries[0]["changed"] == 0
    assert entries[1]["added"] is None
    assert entries[1]["removed"] is None
    assert entries[1]["changed"] is None


def test_activity_log_backfills_missing_git_backup_and_avoids_nearby_duplicate(
    test_client_with_auth, monkeypatch, tmp_path
):
    node = _create_node()
    activity_log = tmp_path / "activity.log"
    monkeypatch.setattr(
        activity_log_service, "ACTIVITY_LOG_FILE", str(activity_log)
    )
    activity_log_service.append_entry(
        node.name,
        node.ip,
        "SUCCESS",
        timestamp="2026-11-22T00:00:30+00:00",
    )
    history = [
        {"oid": "new-commit", "time": "2026-11-23T00:00:00+00:00"},
        {"oid": "old-commit", "time": "2026-11-22T00:00:00+00:00"},
    ]
    configs = {
        "new-commit": "hostname edge-router\nnew setting\nextra line\n",
        "old-commit": "hostname edge-router\nold setting\n",
    }
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_version_history",
        lambda _name: history,
    )
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_version_config",
        lambda _name, oid, _epoch=None: configs[oid],
    )

    response = test_client_with_auth.get("/api/activity-log")

    assert response.status_code == 200
    entries = response.json["entries"]
    backfilled = [
        entry
        for entry in entries
        if entry["timestamp"].startswith("2026-11-23")
    ]
    assert len(backfilled) == 1
    assert backfilled[0]["name"] == node.name
    assert backfilled[0]["status"] == "SUCCESS"
    assert backfilled[0]["added"] == 1
    assert backfilled[0]["removed"] == 0
    assert backfilled[0]["changed"] == 1
    assert len(activity_log_service.read_entries(limit=20)) == 2

    saved_node = Node.get_by_name(node.name)
    assert saved_node.last_backup == "2026-11-23T00:00:00+00:00"
    assert saved_node.last_status == "success"


def test_versions_alias_returns_history(test_client_with_auth, monkeypatch):
    monkeypatch.setattr(
        "routes.oxidized_api.get_oxidized_version_history",
        lambda _name: [{"oid": "latest", "time": "2026-11-23T00:00:00Z"}],
    )

    response = test_client_with_auth.get("/api/oxidized/node/edge-router/versions")

    assert response.status_code == 200
    assert response.json[0]["oid"] == "latest"
