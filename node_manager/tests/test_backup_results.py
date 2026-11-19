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


def test_manual_backup_waits_for_new_git_commit(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"name": "edge-router"}

    history = iter(
        [
            [{"oid": "old-commit"}],
            [{"oid": "old-commit"}],
            [{"oid": "new-commit"}],
        ]
    )
    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service, "get_oxidized_version_history", lambda _name: next(history)
    )
    monkeypatch.setattr(
        oxidized_service, "get_oxidized_node_status", lambda _name, **_kwargs: None
    )
    monkeypatch.setattr(
        oxidized_service, "get_oxidized_config", lambda _name: "hostname edge-router\n"
    )
    monkeypatch.setattr(oxidized_service.time, "sleep", lambda *_args: None)
    monkeypatch.setattr(oxidized_service, "BACKUP_COMPLETION_POLL_ATTEMPTS", 2)

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result == {"success": True}


def test_manual_backup_accepts_updated_completion_time(monkeypatch):
    class OxidizedResponse:
        status_code = 200

        @staticmethod
        def json():
            return {"name": "edge-router"}

    statuses = iter(
        [
            {"stats": {"last": {"end": "2026-01-01T00:00:00Z"}}},
            {"stats": {"last": {"end": "2026-01-01T00:00:01Z"}}},
        ]
    )
    monkeypatch.setattr(
        oxidized_service.requests,
        "get",
        lambda *_args, **_kwargs: OxidizedResponse(),
    )
    monkeypatch.setattr(
        oxidized_service,
        "get_oxidized_version_history",
        lambda _name: [{"oid": "same-commit"}],
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

    result = oxidized_service.trigger_oxidized_backup("edge-router")

    assert result == {"success": True}


def test_manual_backup_failure_is_persisted(test_client_with_auth, monkeypatch):
    node = _create_node()
    monkeypatch.setattr(
        "routes.oxidized_api.trigger_oxidized_backup",
        lambda _name: {"success": False, "error": "connection refused"},
    )

    response = test_client_with_auth.post(
        f"/api/oxidized/node/{node.name}/backup"
    )

    assert response.status_code == 500
    assert response.json["success"] is False
    assert Node.get_by_name(node.name).last_status == "failed"


def test_manual_backup_success_requires_valid_configuration(
    test_client_with_auth, monkeypatch
):
    node = _create_node()
    monkeypatch.setattr(
        "routes.oxidized_api.trigger_oxidized_backup",
        lambda _name: {"success": True},
    )

    response = test_client_with_auth.post(
        f"/api/oxidized/node/{node.name}/backup"
    )

    assert response.status_code == 200
    assert response.json["success"] is True
    saved_node = Node.get_by_name(node.name)
    assert saved_node.last_status == "success"
    assert saved_node.last_backup


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
                "stats": {"last": {"end": "2026-11-19T04:00:00Z"}},
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
                "stats": {"last": {"end": "2026-11-19T04:01:00Z"}},
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
