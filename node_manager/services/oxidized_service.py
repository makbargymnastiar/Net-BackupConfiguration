"""
Oxidized service - Oxidized API integration.
"""

import requests
import os
import time
from datetime import datetime, timezone
from urllib.parse import quote


OXIDIZED_API_URL = os.getenv("OXIDIZED_API_URL", "http://oxidized:8888")
OXIDIZED_CONFIG_FILE = "/oxidized_config/config"
OXIDIZED_API_TOKEN = ""


def set_config(oxidized_url, oxidized_config_file, api_token=""):
    """Set configuration from app.py."""
    global OXIDIZED_API_URL, OXIDIZED_CONFIG_FILE, OXIDIZED_API_TOKEN
    OXIDIZED_API_URL = oxidized_url
    OXIDIZED_CONFIG_FILE = oxidized_config_file
    OXIDIZED_API_TOKEN = api_token


def _get_headers():
    """Build request headers with API token if configured."""
    headers = {}
    if OXIDIZED_API_TOKEN:
        headers["Api-Token"] = OXIDIZED_API_TOKEN
    return headers


def get_oxidized_node_status(node_name, timeout=10):
    """Get single node Oxidized status."""
    try:
        response = requests.get(
            f"{OXIDIZED_API_URL}/node/show/{quote(str(node_name), safe='')}.json",
            headers=_get_headers(),
            timeout=timeout
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Error getting Oxidized status for {node_name}: {e}")
        return None


def get_oxidized_nodes_status():
    """Get all nodes Oxidized status."""
    try:
        response = requests.get(
            f"{OXIDIZED_API_URL}/nodes.json",
            headers=_get_headers(),
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Error getting Oxidized nodes status: {e}")
        return []


def get_oxidized_config(node_name):
    """Get node current config (supports grouped and ungrouped nodes)."""
    group_name = _node_group_name(node_name)
    urls = []
    if group_name:
        urls.append(f"{OXIDIZED_API_URL}/node/fetch/{quote(str(group_name), safe='')}/{quote(str(node_name), safe='')}")
    urls.append(f"{OXIDIZED_API_URL}/node/fetch/{quote(str(node_name), safe='')}")

    for url in urls:
        try:
            response = requests.get(url, headers=_get_headers(), timeout=10)
            if response.status_code == 200 and not _is_oxidized_error_message(response.text):
                return response.text
        except Exception as e:
            print(f"Error getting Oxidized config from {url}: {e}")
    return None


def is_valid_oxidized_config(config):
    """Reject missing, empty, or standalone Oxidized/device error responses."""
    if not isinstance(config, str) or not config.strip():
        return False
    lines = [line.strip().lower() for line in config.strip().splitlines() if line.strip()]
    if not lines:
        return False
    first_line = lines[0]
    if first_line.startswith(
        ("error", "failed", "node not found", "not found", "no config", "timeout", "<!doctype", "<html")
    ):
        return False
    if len(lines) <= 5:
        joined = "\n".join(lines)
        error_markers = (
            "node not found",
            "no config",
            "connection refused",
            "connection timed out",
            "connection timeout",
            "authentication failed",
            "authentication error",
            "auth failed",
            "unable to connect",
            "failed to connect",
            "no_connection",
        )
        if any(marker in joined for marker in error_markers):
            return False
    return True


def _is_oxidized_error_message(message):
    if not isinstance(message, str):
        return False
    content = message.strip().lower()
    error_markers = (
        "node not found",
        "connection refused",
        "connection timed out",
        "connection timeout",
        "authentication failed",
        "authentication error",
        "auth failed",
        "unable to connect",
        "failed to connect",
        "no_connection",
    )
    return any(marker in content for marker in error_markers)


def _get_oxidized_container():
    """Return the configured Oxidized Docker container."""
    import docker

    return docker.from_env().containers.get(
        os.getenv("OXIDIZED_CONTAINER_NAME", "oxidized")
    )


def _run_git(container, repo, args):
    result = container.exec_run(
        ["git", "-c", "safe.directory=*", "-C", repo] + args
    )
    output = result.output.decode("utf-8", errors="replace")
    if result.exit_code != 0 and (
        "safe.bareRepository" in output or "cannot use bare repository" in output
    ):
        result = container.exec_run(
            [
                "git",
                "-c",
                "safe.bareRepository=all",
                "--git-dir",
                repo,
            ]
            + args
        )
        output = result.output.decode("utf-8", errors="replace")
    return result.exit_code, output


def _node_group_name(node_name):
    from models.group import Group
    from models.node import Node

    node = Node.get_by_name(node_name)
    if not node or not node.group_id:
        return None
    group = Group.get_by_id(node.group_id)
    return group.name if group else None


def _get_git_repositories(container, node_name):
    """Discover the node's group repository first, then other Git outputs."""
    base_dir = "/home/oxidized/.config/oxidized"
    configured_repo = _oxidized_git_base()
    group_name = _node_group_name(node_name)
    repositories = []

    def add_repo(path):
        if path and path not in repositories:
            repositories.append(path)

    if (
        group_name
        and group_name not in {".", ".."}
        and os.path.basename(group_name) == group_name
    ):
        repo_roots = []
        for root in (
            os.path.dirname(configured_repo),
            base_dir,
            configured_repo,
        ):
            if root not in repo_roots:
                repo_roots.append(root)
        for root in repo_roots:
            add_repo(os.path.join(root, f"{group_name}.git"))
            add_repo(os.path.join(root, group_name))
        add_repo(f"{configured_repo}-{group_name}")

    add_repo(configured_repo)
    add_repo(base_dir)

    try:
        found = container.exec_run(
            [
                "find",
                base_dir,
                "-maxdepth",
                "5",
                "-type",
                "d",
                "(",
                "-name",
                ".git",
                "-o",
                "-name",
                "*.git",
                ")",
            ]
        )
        if found.exit_code == 0:
            discovered = []
            for line in found.output.decode("utf-8", errors="replace").splitlines():
                path = line.strip()
                if path.endswith("/.git"):
                    path = path[: -len("/.git")]
                if path.endswith(".git") or path in (base_dir, configured_repo):
                    discovered.append(path)
            if group_name:
                discovered.sort(
                    key=lambda path: (
                        os.path.basename(path).lower() != f"{group_name}.git".lower(),
                        path,
                    )
                )
            for path in discovered:
                add_repo(path)
    except Exception as e:
        print(f"WARN: Git repository discovery failed for {node_name}: {e}")

    valid_repositories = []
    for repo in repositories:
        exit_code, _ = _run_git(container, repo, ["rev-parse", "--git-dir"])
        if exit_code == 0:
            valid_repositories.append(repo)
    return valid_repositories


def _node_paths_in_tree(container, repo, node_name, ref):
    exit_code, tree = _run_git(
        container, repo, ["ls-tree", "-r", "--name-only", ref]
    )
    if exit_code != 0:
        return []
    exact = []
    nested = []
    for path in tree.splitlines():
        if path == node_name:
            exact.append(path)
        elif path.endswith("/" + node_name):
            nested.append(path)
    return exact + nested


def _get_repository_for_node(container, node_name):
    for repo in _get_git_repositories(container, node_name):
        paths = _node_paths_in_tree(container, repo, node_name, "HEAD")
        if paths:
            return repo, paths[0]
    return None, None


def get_oxidized_version_history(node_name):
    """Read commit history from the Git repository that stores this node."""
    try:
        container = _get_oxidized_container()
        repo, node_path = _get_repository_for_node(container, node_name)
        if not repo or not node_path:
            return []

        exit_code, listing = _run_git(
            container,
            repo,
            ["log", "--follow", "--format=%H%x09%cI", "--", node_path],
        )
        if exit_code != 0:
            return []

        history = []
        for line in listing.splitlines():
            parts = line.split("\t", 1)
            if len(parts) == 2 and parts[0]:
                history.append({"oid": parts[0], "time": parts[1]})
        return history
    except Exception as e:
        print(f"Error reading Git version history for {node_name}: {e}")
        return []


def _oxidized_git_base():
    """Return the configured Oxidized git repo base path.

    Reads the top-level 'repo:' value from the Oxidized config file
    (output.git.repo) if present, else falls back to the default config dir.
    A plain line scan is used because the config contains Ruby tags
    (e.g. !ruby/regexp) that a strict YAML parser would reject.
    """
    default_base = "/home/oxidized/.config/oxidized"
    try:
        if os.path.exists(OXIDIZED_CONFIG_FILE):
            with open(OXIDIZED_CONFIG_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    stripped = line.strip()
                    if stripped.startswith("repo:"):
                        value = stripped.split(":", 1)[1].strip().strip('"').strip("'")
                        if value:
                            return value.rstrip("/")
                        break
    except Exception as e:
        print(f"Error reading Oxidized repo path from config: {e}")
    return default_base


def get_oxidized_version_config(node_name, oid, epoch=None):
    """Get a specific historical version's config content for a node.

    Oxidized's git output stores configs in a git repository, and when nodes
    belong to a group it keeps a SEPARATE repo per group (laid out as
    '<repo>', '<repo>-<group>' or '<repo>/<group>' depending on settings).

    Previously this function exec'd 'git -C <one hardcoded path>', which was
    both the wrong base directory and blind to per-group repos. That made
    every stored version after a config change unreadable, so Browse/Compare
    appeared to show no new backup even though Oxidized HAD committed it.

    This version DISCOVERS all git repos under the Oxidized config area and
    searches each for the requested commit oid (falling back to an
    epoch-timestamp lookup when the oid is stale, per Oxidized's @gitcache
    bug). This restores multi-version browsing/compare regardless of how
    Oxidized has laid out its repos.
    """
    try:
        container = _get_oxidized_container()
    except Exception as e:
        print(f"ERROR: Docker unavailable for version config: {e}")
        return None

    repos = _get_git_repositories(container, node_name)

    # Resolve the exact SHA in each candidate repository, preferring the
    # repository for this node's group over Oxidized's shared/default repo.
    for repo in repos:
        for path in _node_paths_in_tree(container, repo, node_name, oid):
            ec, cfg = _run_git(container, repo, ["show", f"{oid}:{path}"])
            if ec == 0:
                return cfg

    # 2) Epoch fallback: find the latest commit at/before the timestamp.
    if epoch is not None:
        try:
            epoch_int = int(epoch)
        except (TypeError, ValueError):
            epoch_int = None
        if epoch_int is not None:
            for repo in repos:
                paths = _node_paths_in_tree(container, repo, node_name, "HEAD")
                if not paths:
                    continue
                ec, listing = _run_git(
                    container,
                    repo,
                    [
                        "log",
                        f"--until=@{epoch_int}",
                        "--format=%H",
                        "--follow",
                        "--",
                        paths[0],
                    ],
                )
                if ec == 0 and listing.strip():
                    commit_hash = listing.splitlines()[0].strip()
                    if not commit_hash:
                        continue
                    for path in _node_paths_in_tree(
                        container, repo, node_name, commit_hash
                    ):
                        ec2, cfg = _run_git(
                            container, repo, ["show", f"{commit_hash}:{path}"]
                        )
                        if ec2 == 0:
                            return cfg

    print(
        f"ERROR: version config not found for node={node_name}, "
        f"oid={oid}, epoch={epoch}"
    )
    return None


def _backup_end_time(status):
    if not isinstance(status, dict):
        return None
    stats = status.get("stats") or {}
    last = stats.get("last") or status.get("last") or {}
    return last.get("end") if isinstance(last, dict) else None


def _backup_last_status(status):
    if not isinstance(status, dict):
        return ""
    stats = status.get("stats") or {}
    last = stats.get("last") or status.get("last") or {}
    value = (
        last.get("status")
        if isinstance(last, dict)
        else None
    ) or stats.get("status") or status.get("status")
    return str(value or "").strip().lower()


def is_oxidized_connection_failure_status(status):
    """Return whether Oxidized reports an unreachable/auth/timeout failure."""
    status = str(status or "").strip().lower()
    return any(
        marker in status
        for marker in (
            "no_connection",
            "unreachable",
            "timed out",
            "timeout",
            "refused",
            "auth",
            "connection",
        )
    )


def _is_backup_failure_status(status):
    status = str(status or "").strip().lower()
    return is_oxidized_connection_failure_status(status) or any(
        marker in status
        for marker in ("fail", "error")
    )


def _parse_backup_time(value):
    if isinstance(value, dict):
        value = value.get("end")
    if value is None or value == "":
        return None
    try:
        if isinstance(value, (int, float)):
            parsed = datetime.fromtimestamp(value, tz=timezone.utc)
        else:
            raw = str(value).strip()
            try:
                parsed = datetime.fromtimestamp(float(raw), tz=timezone.utc)
            except ValueError:
                if raw.endswith(" UTC"):
                    raw = raw[:-4].strip() + "+00:00"
                elif raw.endswith("Z"):
                    raw = raw[:-1] + "+00:00"
                parsed = datetime.fromisoformat(raw)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError, OSError):
        return None


BACKUP_COMPLETION_POLL_ATTEMPTS = 90
BACKUP_COMPLETION_POLL_INTERVAL_SECONDS = 1


def trigger_oxidized_backup(node_name):
    """Trigger backup and wait for Oxidized to publish its final node status."""
    try:
        previous_status = get_oxidized_node_status(node_name, timeout=5)
        if not isinstance(previous_status, dict):
            return {
                "success": False,
                "status": "failed",
                "failure_type": "status_unavailable",
                "error": "Unable to read Oxidized node status before backup",
            }
        previous_end = _parse_backup_time(_backup_end_time(previous_status))

        response = requests.get(
            f"{OXIDIZED_API_URL}/node/next/{quote(str(node_name), safe='')}.json",
            headers=_get_headers(),
            timeout=30
        )
        if response.status_code != 200:
            return {
                "success": False,
                "status": "failed",
                "failure_type": "oxidized_error",
                "error": f"Oxidized backup request returned HTTP {response.status_code}",
            }
        try:
            result = response.json()
        except ValueError:
            # Some Oxidized versions return an empty/text acknowledgment while
            # the fetch job continues asynchronously.
            result = {}

        if isinstance(result, dict):
            if result.get("error") or result.get("exception"):
                error_text = " ".join(
                    str(result.get(key) or "")
                    for key in ("error", "exception", "message")
                )
                failure_type = (
                    "connection_failure"
                    if is_oxidized_connection_failure_status(error_text)
                    else "oxidized_error"
                )
                return {
                    "success": False,
                    "status": "failed",
                    "failure_type": failure_type,
                    "error": "Oxidized rejected the backup request",
                }
            if result.get("success") is False or result.get("ok") is False:
                error_text = " ".join(
                    str(result.get(key) or "")
                    for key in ("error", "exception", "message")
                )
                failure_type = (
                    "connection_failure"
                    if is_oxidized_connection_failure_status(error_text)
                    else "oxidized_error"
                )
                return {
                    "success": False,
                    "status": "failed",
                    "failure_type": failure_type,
                    "error": "Oxidized rejected the backup request",
                }
            message = result.get("message")
            if message and _is_oxidized_error_message(str(message)):
                failure_type = (
                    "connection_failure"
                    if is_oxidized_connection_failure_status(message)
                    else "oxidized_error"
                )
                return {
                    "success": False,
                    "status": "failed",
                    "failure_type": failure_type,
                    "error": "Oxidized returned an error for the backup request",
                }
        elif isinstance(result, str) and _is_oxidized_error_message(result):
            failure_type = (
                "connection_failure"
                if is_oxidized_connection_failure_status(result)
                else "oxidized_error"
            )
            return {
                "success": False,
                "status": "failed",
                "failure_type": failure_type,
                "error": "Oxidized returned an error for the backup request",
            }

        deadline = time.monotonic() + (
            BACKUP_COMPLETION_POLL_ATTEMPTS
            * BACKUP_COMPLETION_POLL_INTERVAL_SECONDS
        )
        attempt = 0
        last_status = ""
        while attempt < BACKUP_COMPLETION_POLL_ATTEMPTS and time.monotonic() < deadline:
            remaining = max(0.1, deadline - time.monotonic())
            current_status = get_oxidized_node_status(
                node_name, timeout=min(5, remaining)
            )
            current_end = _parse_backup_time(_backup_end_time(current_status))
            last_status = _backup_last_status(current_status)
            if current_end and current_end != previous_end:
                if _is_backup_failure_status(last_status):
                    connection_failure = is_oxidized_connection_failure_status(
                        last_status
                    )
                    return {
                        "success": False,
                        "status": "failed",
                        "failure_type": (
                            "connection_failure"
                            if connection_failure
                            else "backup_failure"
                        ),
                        "last_backup": current_end.isoformat(timespec="seconds"),
                        "error": f"Oxidized backup finished with status: {last_status}",
                    }
                if last_status != "success":
                    return {
                        "success": False,
                        "status": "failed",
                        "failure_type": "invalid_status",
                        "last_backup": current_end.isoformat(timespec="seconds"),
                        "error": (
                            "Oxidized backup returned no successful final status"
                        ),
                    }
                config = get_oxidized_config(node_name)
                if is_valid_oxidized_config(config):
                    return {
                        "success": True,
                        "status": "success",
                        "last_backup": current_end.isoformat(timespec="seconds"),
                    }
                return {
                    "success": False,
                    "status": "failed",
                    "failure_type": "invalid_configuration",
                    "last_backup": current_end.isoformat(timespec="seconds"),
                    "error": "Oxidized backup returned no valid configuration",
                }

            attempt += 1
            if attempt < BACKUP_COMPLETION_POLL_ATTEMPTS:
                time.sleep(
                    min(BACKUP_COMPLETION_POLL_INTERVAL_SECONDS, max(0, deadline - time.monotonic()))
                )

        return {
            "success": False,
            "status": "failed",
            "failure_type": "polling_timeout",
            "last_backup": (
                previous_end.isoformat(timespec="seconds")
                if previous_end
                else None
            ),
            "error": (
                "Oxidized backup did not complete within 90 seconds"
                + (f" (last status: {last_status})" if last_status else "")
            ),
        }
    except requests.Timeout:
        print(f"Error triggering Oxidized backup for {node_name}")
        return {
            "success": False,
            "status": "failed",
            "failure_type": "oxidized_request_timeout",
            "error": "Timed out while requesting a backup from Oxidized",
        }
    except requests.ConnectionError:
        print(f"Error connecting to Oxidized for {node_name}")
        return {
            "success": False,
            "status": "failed",
            "failure_type": "oxidized_unavailable",
            "error": "Unable to connect to Oxidized",
        }
    except requests.RequestException:
        print(f"Error triggering Oxidized backup for {node_name}")
        return {
            "success": False,
            "status": "failed",
            "failure_type": "oxidized_error",
            "error": "Backup request failed",
        }


def get_oxidized_info():
    """Get Oxidized global config info."""
    interval = read_oxidized_interval()
    return {
        "interval": interval,
        "interval_display": format_interval(interval)
    }


def read_oxidized_interval():
    """Read interval from Oxidized config file (in seconds)."""
    try:
        if os.path.exists(OXIDIZED_CONFIG_FILE):
            with open(
                OXIDIZED_CONFIG_FILE,
                "r",
                encoding="utf-8"
            ) as f:
                content = f.read()

                for line in content.splitlines():
                    if line.startswith("interval:"):
                        value = line.split(":", 1)[1].strip()
                        return int(value)

        return 3600

    except Exception as e:
        print(f"Error reading Oxidized interval: {e}")
        return 3600


def write_oxidized_interval(seconds):
    """Write interval to Oxidized config file."""
    try:
        if not os.path.exists(OXIDIZED_CONFIG_FILE):
            return False

        with open(
            OXIDIZED_CONFIG_FILE,
            "r",
            encoding="utf-8"
        ) as f:
            lines = f.readlines()

        with open(
            OXIDIZED_CONFIG_FILE,
            "w",
            encoding="utf-8"
        ) as f:
            for line in lines:
                if line.startswith("interval:"):
                    f.write(f"interval: {seconds}\n")
                else:
                    f.write(line)

        return True

    except Exception as e:
        print(f"Error writing Oxidized interval: {e}")
        return False


def format_interval(seconds):
    """Format interval to human readable string."""
    if seconds >= 3600:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''}"

    elif seconds >= 60:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''}"

    else:
        return f"{seconds} seconds"


def reload_oxidized_config():
    """Trigger Oxidized to reload config."""
    try:
        response = requests.get(
            f"{OXIDIZED_API_URL}/reload.json",
            headers=_get_headers(),
            timeout=5
        )
        return response.status_code == 200

    except Exception as e:
        print(f"Warning: Failed to reload Oxidized config: {e}")
        return False
