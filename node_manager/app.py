from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    jsonify,
    flash,
    abort,
)
import json
import csv
import os
import base64
from datetime import datetime
from functools import wraps

# Import new database module
from database import init_database, get_db_path, ensure_csv_synced, get_config_setting
from models.node import Node
from models.user import User

# Import new route blueprints
from routes import nodes_bp, auth_bp, oxidized_api_bp, config_bp, credentials_bp, models_bp
from routes.groups_api import groups_bp
from routes.activity_log_api import activity_log_bp
from routes.pages import pages_bp
from routes.nodes import set_config as set_nodes_config

# Create Flask app
app = Flask(__name__)

# auth.py no longer uses set_config (now uses User model with SQLite)
from routes.oxidized_api import set_config as set_oxidized_api_config
import services.oxidized_service as oxidized_service
import services.docker_service as docker_service
import services.activity_log_service as activity_log_service

# Flask session signing key. Deliberately NO hardcoded fallback (anyone with
# the repo could forge session cookies) and NO silent random fallback (that
# would invalidate every session on each restart and hide the misconfig). A
# blank or whitespace-only SECRET_KEY is a configuration error, so we fail
# fast at startup with a clear, actionable message. docker-compose already
# guards with `${SECRET_KEY:?...}`; this is defense-in-depth for every run
# mode (systemd, gunicorn, local, container). Use os.getenv(..., "").strip()
# so an EMPTY STRING (what Compose `${SECRET_KEY:-}` injects when .env is
# missing) is treated the same as unset.
def _resolve_secret_key(raw):
    """Return SECRET_KEY stripped; raise a clear config error if blank."""
    key = (raw or "").strip()
    if not key:
        raise RuntimeError(
            "CONFIG ERROR: SECRET_KEY is required but is empty or unset. "
            "Create a .env file next to docker-compose.yml containing "
            "SECRET_KEY=<long random value>, generated with "
            "`openssl rand -hex 32`. Never commit .env to Git "
            "(it is already listed in .gitignore)."
        )
    return key


app.secret_key = _resolve_secret_key(os.getenv("SECRET_KEY", ""))

CONFIG_FILE = os.getenv("CONFIG_FILE", "/oxidized_config/nodes.csv")
OXIDIZED_API_URL = os.getenv("OXIDIZED_API_URL", "http://oxidized:8888")
OXIDIZED_CONFIG_FILE = "/oxidized_config/config"
MODELS_FILE = "/oxidized_config/models.json"
CREDENTIALS_FILE = "/oxidized_config/credentials.json"
ACTIVITY_LOG_FILE = os.getenv("ACTIVITY_LOG_FILE", "/oxidized_config/activity_log.txt")

# Initialize database on module load
init_database()

# Ensure CSV is synced with database (fixes git checkout issues)
ensure_csv_synced()

# Configure new modules with app settings
set_nodes_config(OXIDIZED_API_URL, CONFIG_FILE)
# set_auth_config removed - auth now uses User model with SQLite
set_oxidized_api_config(OXIDIZED_API_URL, OXIDIZED_CONFIG_FILE)
activity_log_service.set_config(ACTIVITY_LOG_FILE)
# Load Oxidized API token from database
OXIDIZED_API_TOKEN = get_config_setting("oxidized_api_token", "")
oxidized_service.set_config(OXIDIZED_API_URL, OXIDIZED_CONFIG_FILE, OXIDIZED_API_TOKEN)

# Register blueprints (new modular routes)
# Note: Old routes have been migrated to blueprints under the /api namespace.
app.register_blueprint(nodes_bp)
app.register_blueprint(auth_bp)
app.register_blueprint(oxidized_api_bp)
app.register_blueprint(config_bp)
app.register_blueprint(models_bp)
app.register_blueprint(groups_bp)
app.register_blueprint(credentials_bp)
app.register_blueprint(activity_log_bp)
app.register_blueprint(pages_bp)

# Initialize config versions
from routes.config_api import init_config_versions
init_config_versions()


def encode_password(pwd):
    """Encode password to Base64"""
    if not pwd:
        return ""
    return base64.b64encode(pwd.encode()).decode()


def decode_password(encoded):
    """Decode password from Base64"""
    if not encoded:
        return ""
    try:
        return base64.b64decode(encoded.encode()).decode()
    except:
        return ""


# All supported Oxidized Models
ALL_MODELS = {
    "ios": "Cisco IOS",
    "iosxe": "Cisco IOS-XE",
    "iosxr": "Cisco IOS-XR",
    "nxos": "Cisco NX-OS",
    "asa": "Cisco ASA",
    "ciscosmb": "Cisco Small Business (SF300/500)",
    "ciscosma": "Cisco SMA",
    "ciscoce": "Cisco CE",
    "junos": "Juniper JunOS",
    "vrp": "Huawei VRP",
    "huawei": "Huawei",
    "procurve": "HP ProCurve",
    "hpmsm": "HP MSM",
    "dellx": "Dell PowerConnect",
    "arista": "Arista EOS",
    "eos": "Arista EOS",
    "vyos": "VyOS",
    "routeros": "MikroTik RouterOS",
    "fortios": "FortiOS",
    "pfsense": "pfSense",
    "opnsense": "OPNsense",
    "panos": "Palo Alto PAN-OS",
    "sonicos": "SonicWALL",
    "ubiquiti": "Ubiquiti",
    "edgecos": "EdgeCOS",
    "dlink": "D-Link",
    "netgear": "Netgear",
    "linksyssrw": "Linksys SRW",
    "tplink": "TP-Link",
    "zynos": "Zynos",
    "comware": "HP Comware",
    "fastiron": "FastIron",
    "aireos": "Cisco AireOS",
    "meraki": "Cisco Meraki",
    "acos": "A10 ADC",
    "adtran": "Adtran",
    "alcatel": "Alcatel-Lucent",
    "aruba": "Aruba OS",
    "avaya": "Avaya",
    "broadcom": "Broadcom",
    "caleos": "CALEOS",
    "cumulus": "Cumulus Linux",
    "dnos": "Dell DNOS",
    "eos": "Arista EOS",
    "exec": "Generic Exec",
    "gaiaos": "Check Point Gaia",
    "hpeos": "HPE OS",
    "ingenico": "Ingenico",
    "ipos": "IPOS",
    "ironware": "Brocade IronWare",
    "keys": "Keys",
    "linuxgeneric": "Linux Generic",
    "microsens": "Microsens",
    "miranda": "Miranda",
    "mrv": "MRV",
    "netonix": "Netonix",
    "oneos": "OneOS",
    "openbsd": "OpenBSD",
    "openwrt": "OpenWrt",
    "orion": "Orion",
    "panos_api": "Palo Alto API",
    "powerconnect": "Dell PowerConnect",
    "radware": "Radware",
    "rgos": "RGOS",
    "riverbed": "Riverbed",
    "saos": "SAOS",
    "screenos": "Juniper ScreenOS",
    "slxos": "Brocade SLXOS",
    "sros": "Nokia SROS",
    "superloop": "Superloop",
    "tmos": "F5 TMOS",
    "tnos": "TNOS",
    "ubiquiti": "Ubiquiti",
    "vrp": "Huawei VRP",
    "weos": "Cumulus WEOS",
    "xos": "XOS",
    "zynoscli": "Zynos CLI",
}


def load_enabled_models():
    """Load the list of enabled models"""
    if os.path.exists(MODELS_FILE):
        try:
            with open(MODELS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    # Default to commonly used models
    return [
        "ios",
        "iosxe",
        "junos",
        "huawei",
        "vrp",
        "ciscosmb",
        "procurve",
        "vyos",
        "routeros",
        "fortios",
    ]


def save_enabled_models(models):
    """Save the list of enabled models"""
    os.makedirs(os.path.dirname(MODELS_FILE), exist_ok=True)
    with open(MODELS_FILE, "w", encoding="utf-8") as f:
        json.dump(models, f, indent=2)


# Default credentials
DEFAULT_CREDENTIALS = [
    {
        "id": "huawei-admin",
        "label": "Huawei Admin",
        "username": "admin",
        "password": encode_password("Admin@123"),
        "enable_password": encode_password("Admin@123"),
        "description": "Huawei device standard admin account",
        "enabled": True,
    },
    {
        "id": "cisco-admin",
        "label": "Cisco Admin",
        "username": "admin",
        "password": encode_password("cisco123"),
        "enable_password": encode_password("cisco123"),
        "description": "Cisco device standard admin account",
        "enabled": True,
    },
]


def load_credentials():
    """Load the credentials list"""
    if os.path.exists(CREDENTIALS_FILE):
        try:
            with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    # Return default credentials
    return DEFAULT_CREDENTIALS.copy()


def save_credentials(credentials):
    """Save the credentials list"""
    os.makedirs(os.path.dirname(CREDENTIALS_FILE), exist_ok=True)
    with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(credentials, f, indent=2)


# Default user configuration (initial passwords)
# NOTE: the legacy plaintext users.json helpers (load_users/save_users) and the
# user_status.json "password changed" flag file were both removed. Credentials
# live bcrypt-hashed in the SQLite users table, and the first-login change
# requirement is tracked by the users.must_change_password column, which
# pages.is_user_password_changed reads directly. No file-based user state remains.


# [REFACTORED] Page routes moved to pages_bp (routes/pages.py)
# [REFACTORED] login_required decorator moved to routes/auth.py
# Page routes now handled by: pages.login_page, pages.dashboard, etc.
# Note: pages_bp is registered at line ~71 and handles all /login, /dashboard, / routes
# All page routes migrated to routes/pages.py - do not add inline page routes here



def migrate_csv_to_database():
    """
    Migrate nodes from CSV file to database.
    This is a one-time migration to move data from CSV to SQLite.
    Returns the number of nodes migrated.
    """
    # Check if database already has data
    existing_nodes = Node.get_all()
    if existing_nodes:
        print(f"Database already has {len(existing_nodes)} nodes, skipping migration")
        return 0

    # Read from CSV
    if not os.path.exists(CONFIG_FILE):
        print(f"CSV file {CONFIG_FILE} not found, nothing to migrate")
        return 0

    csv_nodes = []
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row:
                csv_nodes.append(row)

    if not csv_nodes:
        print("CSV file is empty, nothing to migrate")
        return 0

    # Migrate to database
    for node_data in csv_nodes:
        node = Node(
            name=node_data.get("name", ""),
            ip=node_data.get("ip", ""),
            model=node_data.get("model", "").lower(),
            protocol=node_data.get("protocol", "ssh"),
            port=int(node_data.get("port", 22)),
            username=node_data.get("username", ""),
            password=node_data.get("password", ""),
        )
        node.save()

    print(f"Migrated {len(csv_nodes)} nodes from CSV to database")
    return len(csv_nodes)


def sync_oxidized_status_to_database():
    """
    Sync backup status from Oxidized API to local database.
    This updates last_backup and last_status for all nodes.
    """
    oxidized_status = get_oxidized_nodes_status()
    if not oxidized_status or not isinstance(oxidized_status, dict):
        return

    for node_name, status_data in oxidized_status.items():
        node = Node.get_by_name(node_name)
        if node:
            # Get the latest stats
            stats = status_data.get("stats", {})
            last_sync = stats.get("last", {}).get("end")
            if last_sync:
                node.last_backup = last_sync
                node.last_status = "success"
            else:
                node.last_status = "pending"
            node.save()


# ==================== Oxidized API Integration ====================


# [REFACTORED] Oxidized API functions moved to services/oxidized_service.py
from services.oxidized_service import (
    get_oxidized_node_status,
    get_oxidized_nodes_status,
    get_oxidized_config,
    get_oxidized_version_history,
    get_oxidized_version_config,
    trigger_oxidized_backup,
    get_oxidized_info,
    read_oxidized_interval,
    write_oxidized_interval,
    format_interval,
)

if __name__ == "__main__":
    print(f"Database path: {get_db_path()}")
    
    # Jalankan migration
    print("Checking for CSV to database migration...")
    migrate_csv_to_database()

    print("Starting Oxidized Node Manager...")
    
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True,
        use_reloader=True
    )
