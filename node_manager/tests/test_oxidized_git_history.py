"""Tests for reading exact Oxidized Git backup revisions."""

import subprocess
from types import SimpleNamespace

from services import oxidized_service


class LocalGitContainer:
    """Run the service's Git commands against a temporary local repository."""

    @staticmethod
    def exec_run(command):
        result = subprocess.run(command, capture_output=True, check=False)
        return SimpleNamespace(
            exit_code=result.returncode,
            output=result.stdout + result.stderr,
        )


def _git(repo, *args):
    subprocess.run(["git", "-C", str(repo), *args], check=True, capture_output=True)


def test_history_and_config_use_exact_git_commit(tmp_path, monkeypatch):
    repo = tmp_path / "Gedung SMR.git"
    working_repo = tmp_path / "working-repo"
    working_repo.mkdir()
    _git(working_repo, "init", "-q")
    _git(working_repo, "config", "user.name", "Oxidized Test")
    _git(working_repo, "config", "user.email", "oxidized@example.test")

    config = working_repo / "edge-router"
    config.write_text("hostname edge-router\nversion 1\n", encoding="utf-8")
    _git(working_repo, "add", "edge-router")
    _git(working_repo, "commit", "-m", "first backup", "-q")
    first_oid = subprocess.run(
        ["git", "-C", str(working_repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()

    config.write_text("hostname edge-router\nversion 2\n", encoding="utf-8")
    _git(working_repo, "commit", "-am", "second backup", "-q")
    second_oid = subprocess.run(
        ["git", "-C", str(working_repo), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    subprocess.run(
        ["git", "clone", "--bare", str(working_repo), str(repo)],
        check=True,
        capture_output=True,
    )

    monkeypatch.setattr(
        oxidized_service, "_get_oxidized_container", lambda: LocalGitContainer()
    )
    monkeypatch.setattr(
        oxidized_service, "_get_git_repositories", lambda _container, _node: [str(repo)]
    )

    history = oxidized_service.get_oxidized_version_history("edge-router")

    assert [entry["oid"] for entry in history] == [second_oid, first_oid]
    assert oxidized_service.get_oxidized_version_config(
        "edge-router", second_oid
    ) == "hostname edge-router\nversion 2\n"
    assert oxidized_service.get_oxidized_version_config(
        "edge-router", first_oid
    ) == "hostname edge-router\nversion 1\n"
