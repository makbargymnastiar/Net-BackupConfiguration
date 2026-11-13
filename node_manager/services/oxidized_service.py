"""
Oxidized service - Oxidized API integration.
"""

import requests
import os


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


def get_oxidized_node_status(node_name):
    """Get single node Oxidized status."""
    try:
        response = requests.get(
            f"{OXIDIZED_API_URL}/node/{node_name}.json",
            headers=_get_headers(),
            timeout=10
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
    """Get node current config."""
    try:
        response = requests.get(
            f"{OXIDIZED_API_URL}/node/fetch/{node_name}",
            headers=_get_headers(),
            timeout=10
        )
        if response.status_code == 200:
            return response.text
        return None
    except Exception as e:
        print(f"Error getting Oxidized config for {node_name}: {e}")
        return None


def get_oxidized_version_history(node_name):
    """Get node version history."""
    try:
        response = requests.get(
            f"{OXIDIZED_API_URL}/node/version.json?node_full={node_name}",
            headers=_get_headers(),
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        print(f"Error getting Oxidized version history for {node_name}: {e}")
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
    import docker

    try:
        client = docker.from_env()
        container = client.containers.get("oxidized")
    except Exception as e:
        print(f"ERROR: Docker unavailable for version config: {e}")
        return None

    base_dir = "/home/oxidized/.config/oxidized"

    def git(repo, args):
        result = container.exec_run(
            ["git", "-c", "safe.directory=*", "-C", repo] + args
        )
        return result.exit_code, result.output.decode(
            "utf-8", errors="replace"
        )

    # Candidate repos: the configured repo base + default + every directory
    # that contains a .git (covers per-group repos). Discovery is best-effort.
    repos = {base_dir, _oxidized_git_base()}
    try:
        found = container.exec_run(
            ["find", base_dir, "-maxdepth", "4", "-type", "d", "-name", ".git"]
        )
        if found.exit_code == 0:
            for line in found.output.decode("utf-8", errors="replace").splitlines():
                line = line.strip()
                if line.endswith("/.git"):
                    repos.add(line[: -len("/.git")])
    except Exception as e:
        print(f"WARN: git repo discovery failed, using base paths only: {e}")

    def node_paths_in_tree(repo, ref):
        """Return file paths in the tree at 'ref' that belong to node_name,
        preferring an exact root-level match over a group sub-directory one."""
        ec, tree = git(repo, ["ls-tree", "-r", "--name-only", ref])
        if ec != 0:
            return []
        exact, nested = [], []
        for raw in tree.splitlines():
            p = raw.strip()
            if p == node_name:
                exact.append(p)
            elif p.endswith("/" + node_name):
                nested.append(p)
        return exact + nested

    # 1) Direct oid lookup across every discovered repo.
    for repo in repos:
        for p in node_paths_in_tree(repo, oid):
            ec, cfg = git(repo, ["show", f"{oid}:{p}"])
            if ec == 0:
                return cfg
        # Flat-path fallback for repos without a resolvable ls-tree.
        for p in (node_name, "/" + node_name):
            ec, cfg = git(repo, ["show", f"{oid}:{p}"])
            if ec == 0:
                return cfg

    # 2) Epoch-based fallback: newest commit touching this node at/before the
    # timestamp, then read that exact file from the same repo.
    if epoch:
        try:
            epoch_int = int(epoch)
        except (TypeError, ValueError):
            epoch_int = None
        if epoch_int is not None:
            from datetime import datetime, timezone

            date_str = datetime.fromtimestamp(
                epoch_int, tz=timezone.utc
            ).strftime("%Y-%m-%d %H:%M:%S")
            for repo in repos:
                ec, listing = git(
                    repo,
                    ["log", "--until", date_str, "--format=%H", "--", node_name],
                )
                if ec == 0 and listing.strip():
                    commit_hash = listing.splitlines()[0].strip()
                    if not commit_hash:
                        continue
                    for p in node_paths_in_tree(repo, commit_hash):
                        ec2, cfg = git(
                            repo, ["show", f"{commit_hash}:{p}"]
                        )
                        if ec2 == 0:
                            return cfg
                    for p in (node_name, "/" + node_name):
                        ec2, cfg = git(
                            repo, ["show", f"{commit_hash}:{p}"]
                        )
                        if ec2 == 0:
                            return cfg

    print(
        f"ERROR: version config not found for node={node_name}, "
        f"oid={oid}, epoch={epoch}"
    )
    return None


def trigger_oxidized_backup(node_name):
    """Trigger immediate backup."""
    try:
        response = requests.get(
            f"{OXIDIZED_API_URL}/node/next/{node_name}.json",
            headers=_get_headers(),
            timeout=30
        )
        if response.status_code == 200:
            return response.json()
        return {"error": f"HTTP {response.status_code}"}
    except Exception as e:
        print(f"Error triggering Oxidized backup for {node_name}: {e}")
        return {"error": "Backup request failed"}


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
