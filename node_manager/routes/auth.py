"""
Auth routes - Authentication and user management with bcrypt.
"""

from flask import request, jsonify, redirect, url_for, session
from functools import wraps
from routes import auth_bp
from models.user import User


def is_first_time() -> bool:
    """Check if this is first time setup (no users in database)."""
    return len(User.get_all()) == 0


def login_required(f):
    """Login required decorator - redirects to pages.login_page."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "username" not in session:
            return redirect(url_for("pages.login_page"))
        return f(*args, **kwargs)

    return decorated_function


def admin_required(f):
    """Admin required decorator."""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "username" not in session:
            return redirect(url_for("auth.login"))
        from models.user import User
        user = User.get_by_username(session.get("username"))
        if not user or user.role != "admin":
            return jsonify({"success": False, "error": "Admin access required"}), 403
        return f(*args, **kwargs)

    return decorated_function


@auth_bp.route("/api/login", methods=["POST"])
def login():
    """User login."""
    # First time setup check
    if is_first_time():
        return jsonify(
            {
                "success": False,
                "error": "first_time_setup",
                "message": "Please create an admin account first",
            }
        )

    data = request.json
    username = data.get("username", "")
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"success": False, "error": "Please enter username and password"})

    user = User.authenticate(username, password)
    if user:
        session["username"] = user.username
        # Check if user must change password
        if user.must_change_password:
            return jsonify(
                {
                    "success": True,
                    "must_change_password": True,
                    "message": "You must change your password on first login",
                }
            )
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Invalid username or password"})


@auth_bp.route("/api/setup", methods=["POST"])
def setup():
    """First time setup - create admin account."""
    if not is_first_time():
        return jsonify({"success": False, "error": "System already configured, please log in"})

    data = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    # Validation
    if not username or not password:
        return jsonify({"success": False, "error": "Username and password cannot be empty"})

    if len(username) < 3:
        return jsonify({"success": False, "error": "Username must be at least 3 characters"})

    if len(password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters"})

    if password != confirm_password:
        return jsonify({"success": False, "error": "Passwords do not match"})

    if password.lower() in ["password", "12345678", "admin123"]:
        return jsonify({"success": False, "error": "Password is too weak, please use a more complex password"})

    # Create admin user
    try:
        user = User.create_user(username=username, password=password, role="admin")
        session["username"] = user.username
        return jsonify({"success": True})
    except Exception:
        return jsonify({"success": False, "error": "Failed to create user"})


@auth_bp.route("/api/check-setup-status", methods=["GET"])
def check_setup_status():
    """Check if system needs setup."""
    return jsonify({"needs_setup": is_first_time()})


@auth_bp.route("/api/logout")
def logout():
    """User logout."""
    session.pop("username", None)
    return redirect(url_for("pages.login_page"))


@auth_bp.route("/api/user-info")
@login_required
def user_info():
    """Get current user info."""
    username = session.get("username")
    user = User.get_by_username(username)
    if user:
        return jsonify(
            {
                "username": user.username,
                "role": user.role,
                "must_change_password": user.must_change_password,
            }
        )
    return jsonify({"username": username})


@auth_bp.route("/api/change-password", methods=["POST"])
@login_required
def change_password():
    """Change current user password."""
    data = request.json
    username = session.get("username")
    user = User.get_by_username(username)

    if not user:
        return jsonify({"success": False, "error": "User not found"})

    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    confirm_password = data.get("confirm_password", "")

    if len(new_password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters"})

    if new_password != confirm_password:
        return jsonify({"success": False, "error": "Passwords do not match"})

    if not user.check_password(current_password):
        return jsonify({"success": False, "error": "Current password is incorrect"})

    if new_password.lower() in ["password", "12345678", "admin123"]:
        return jsonify({"success": False, "error": "Password is too weak"})

    user.password_hash = User.hash_password(new_password)
    user.clear_must_change_password()

    return jsonify({"success": True, "message": "Password changed successfully"})


@auth_bp.route("/api/users", methods=["GET", "POST"])
@login_required
def users_api():
    """Get all users or create a new user."""
    if request.method == "GET":
        users = User.get_all()
        return jsonify([u.to_dict() for u in users])

    if request.method == "POST":
        # Admin only for creating users
        current_user = User.get_by_username(session.get("username"))
        if not current_user or current_user.role != "admin":
            return jsonify({"success": False, "error": "Admin access required"}), 403

        data = request.json
        username = data.get("username", "").strip()
        password = data.get("password", "")
        role = data.get("role", "user")

        if not username or not password:
            return jsonify({"success": False, "error": "Username and password cannot be empty"})

        if len(username) < 3:
            return jsonify({"success": False, "error": "Username must be at least 3 characters"})

        if len(password) < 8:
            return jsonify({"success": False, "error": "Password must be at least 8 characters"})

        if User.get_by_username(username):
            return jsonify({"success": False, "error": "User already exists"})

        try:
            User.create_user(username=username, password=password, role=role)
            return jsonify({"success": True})
        except Exception:
            return jsonify({"success": False, "error": "Failed to create user"})


@auth_bp.route("/api/users/<username>", methods=["DELETE"])
@login_required
def delete_user(username):
    """Delete a user. Admin only."""
    current_user = User.get_by_username(session.get("username"))
    if not current_user or current_user.role != "admin":
        return jsonify({"success": False, "error": "Admin access required"}), 403

    if username == current_user.username:
        return jsonify({"success": False, "error": "You cannot delete your own account"})

    user = User.get_by_username(username)
    if not user:
        return jsonify({"success": False, "error": "User not found"})

    User.delete_by_id(user.id)
    return jsonify({"success": True})


@auth_bp.route("/api/users-admin-change-password", methods=["POST"])
@login_required
def users_admin_change_password():
    """Admin change user password. Admin only."""
    current_user = User.get_by_username(session.get("username"))
    if not current_user or current_user.role != "admin":
        return jsonify({"success": False, "error": "Admin access required"}), 403

    data = request.json
    username = data.get("username", "")
    new_password = data.get("new_password", "")
    confirm_password = data.get("confirm_password", "")

    if not username or not new_password:
        return jsonify({"success": False, "error": "Username and password cannot be empty"})

    user = User.get_by_username(username)
    if not user:
        return jsonify({"success": False, "error": "User not found"})

    if len(new_password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters"})

    if new_password != confirm_password:
        return jsonify({"success": False, "error": "Passwords do not match"})

    user.password_hash = User.hash_password(new_password)
    user.save()

    return jsonify({"success": True})


@auth_bp.route("/api/force-change-password", methods=["POST"])
@login_required
def force_change_password():
    """Force change password on first login.

    bcrypt-backed (same as the other change-password routes): the old version
    verified and stored passwords in plaintext inside users.json, leaking real
    credentials to a world-readable file — never touch that file again. The
    must_change_password column on the SQLite user is the only state now.
    """
    data = request.json
    username = session.get("username")
    user = User.get_by_username(username)

    if not user:
        return jsonify({"success": False, "error": "User not found"})

    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not user.check_password(current_password):
        return jsonify({"success": False, "error": "Current password is incorrect"})

    if len(new_password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters"})

    if new_password.lower() in ["password", "12345678", "admin123"]:
        return jsonify({"success": False, "error": "Password is too weak, please use a more complex password"})

    user.password_hash = User.hash_password(new_password)
    user.clear_must_change_password()

    return jsonify({"success": True})
