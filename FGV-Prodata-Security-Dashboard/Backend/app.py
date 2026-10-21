import json
import os
import re
import secrets
import hashlib
import hmac
import base64
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage

from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Flask, request, jsonify
from flask_cors import CORS

from database import get_db_connection

load_dotenv()

app = Flask(__name__)
CORS(app)


# =====================================================
# PASSWORD RESET OTP (Gmail SMTP + MySQL)
# =====================================================
OTP_TTL_MINUTES = 5
OTP_MAX_ATTEMPTS = 5

def send_otp_email(to_email, otp, purpose="password_reset"):
    """Send a one-time code. SMTP credentials must be stored in Backend/.env."""
    required = ["SMTP_EMAIL", "SMTP_PASSWORD"]
    if any(not os.getenv(key) for key in required):
        raise RuntimeError("SMTP_EMAIL and SMTP_PASSWORD must be configured in Backend/.env")

    message = EmailMessage()
    is_login = purpose == "login"
    message["Subject"] = "FGV Prodata - Login verification OTP" if is_login else "FGV Prodata - Password Reset OTP"
    message["From"] = os.environ["SMTP_EMAIL"]
    message["To"] = to_email
    action = "sign-in verification" if is_login else "password reset"
    message.set_content(
        f"Your FGV Prodata {action} code is: {otp}\n\n"
        f"This code expires in {OTP_TTL_MINUTES} minutes.\n"
        "If you did not request this, you can ignore this email. Do not share this code."
    )
    with smtplib.SMTP(os.getenv("SMTP_HOST", "smtp.gmail.com"), int(os.getenv("SMTP_PORT", "587")), timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(os.environ["SMTP_EMAIL"], os.environ["SMTP_PASSWORD"])
        server.send_message(message)

def ensure_password_reset_table(cursor):
    cursor.execute(
        """CREATE TABLE IF NOT EXISTS password_reset_otps (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT NOT NULL,
            otp_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            used TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_reset_user (user_id),
            INDEX idx_reset_expiry (expires_at)
        ) ENGINE=InnoDB"""
    )

# Short-lived signed token used by the Admin User Management API.
# Configure FGV_ADMIN_TOKEN_SECRET in Backend/.env for a stable secret across restarts.
def _load_stable_admin_token_secret():
    """Prefer an explicit .env secret; otherwise persist a random key beside app.py.

    A random in-memory fallback changes whenever Flask restarts, which invalidates
    every browser token even though its 8-hour expiry has not elapsed.
    """
    configured = os.getenv("FGV_ADMIN_TOKEN_SECRET") or os.getenv("SECRET_KEY")
    if configured:
        return configured.encode("utf-8")
    secret_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".fgv_admin_token_secret")
    try:
        with open(secret_path, "r", encoding="utf-8") as secret_file:
            secret = secret_file.read().strip()
        if secret:
            return secret.encode("utf-8")
    except FileNotFoundError:
        pass
    secret = secrets.token_hex(32)
    try:
        fd = os.open(secret_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as secret_file:
            secret_file.write(secret)
        return secret.encode("utf-8")
    except FileExistsError:
        with open(secret_path, "r", encoding="utf-8") as secret_file:
            return secret_file.read().strip().encode("utf-8")

_ADMIN_TOKEN_SECRET = _load_stable_admin_token_secret()
_ADMIN_TOKEN_TTL_SECONDS = 8 * 60 * 60

def _b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def issue_api_token(user):
    payload = {
        "id": int(user["id"]),
        "email": str(user["email"]).strip().lower(),
        "role": str(user["role"]),
        "exp": int(datetime.utcnow().timestamp()) + _ADMIN_TOKEN_TTL_SECONDS,
    }
    encoded = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _b64url(hmac.new(_ADMIN_TOKEN_SECRET, encoded.encode("ascii"), hashlib.sha256).digest())
    return encoded + "." + signature

def read_api_token():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        encoded, signature = header[7:].strip().split(".", 1)
        expected = _b64url(hmac.new(_ADMIN_TOKEN_SECRET, encoded.encode("ascii"), hashlib.sha256).digest())
        if not hmac.compare_digest(signature, expected):
            return None
        padded = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        if int(payload.get("exp", 0)) < int(datetime.utcnow().timestamp()):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError):
        return None

def require_admin():
    actor = read_api_token()
    if not actor:
        return None, (jsonify({"success": False, "message": "Your session is invalid or expired. Please log in again."}), 401)
    if actor.get("role") not in ("Admin", "IT Security Admin"):
        return None, (jsonify({"success": False, "message": "Admin access is required."}), 403)
    return actor, None


def hash_otp(otp):
    return hashlib.sha256(otp.encode("utf-8")).hexdigest()


def is_placeholder_email(email):
    """Placeholder accounts are local/demo identities and must never receive email OTPs."""
    value = str(email or "").strip().lower()
    return value.endswith(("@local.admin", "@local.fgv", "@local.felda"))


def make_session_user(user):
    role_map = {"Admin": "admin", "IT Security Admin": "admin",
                "FGV Management": "fgv", "FELDA Management": "felda"}
    return {
        "id": user["id"], "name": user["full_name"], "email": user["email"],
        "role": role_map[user["role"]], "api_token": issue_api_token(user)
    }

def ensure_login_otp_table(cursor):
    cursor.execute(
        """CREATE TABLE IF NOT EXISTS login_otps (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id BIGINT NOT NULL,
            otp_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            attempts INT NOT NULL DEFAULT 0,
            used TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_login_otp_user (user_id),
            INDEX idx_login_otp_expiry (expires_at)
        ) ENGINE=InnoDB"""
    )


@app.route("/api/auth/login", methods=["POST"])
def login_user():
    """Validate password and send OTP; do not create a dashboard session yet."""
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required."}), 400

    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, full_name, email, password_hash, role FROM users "
            "WHERE LOWER(email) = %s AND is_active = 1 LIMIT 1", (email,)
        )
        user = cursor.fetchone()
        if not user or not check_password_hash(user["password_hash"], password):
            return jsonify({"success": False, "message": "Invalid email or password."}), 401

        role_map = {"Admin": "admin", "IT Security Admin": "admin",
                    "FGV Management": "fgv", "FELDA Management": "felda"}
        if user["role"] not in role_map:
            app.logger.error("Unsupported role for user id %s: %r", user["id"], user["role"])
            return jsonify({"success": False, "message": "This account has an unsupported role. Contact the administrator."}), 403

        # Placeholder accounts use password authentication only; never send OTP to fake domains.
        if is_placeholder_email(user["email"]):
            return jsonify({
                "success": True,
                "requires_otp": False,
                "user": make_session_user(user),
                "message": "Signed in using the local placeholder account."
            })

        ensure_login_otp_table(cursor)
        otp = f"{secrets.randbelow(1_000_000):06d}"
        cursor.execute("UPDATE login_otps SET used = 1 WHERE user_id = %s AND used = 0", (user["id"],))
        cursor.execute(
            "INSERT INTO login_otps (user_id, otp_hash, expires_at) VALUES (%s, %s, %s)",
            (user["id"], hash_otp(otp), datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES))
        )
        connection.commit()
        try:
            send_otp_email(user["email"], otp, purpose="login")
        except Exception:
            app.logger.exception("Failed to send login OTP email")
            cursor.execute("UPDATE login_otps SET used = 1 WHERE user_id = %s AND used = 0", (user["id"],))
            connection.commit()
            return jsonify({"success": False, "message": "Unable to send login OTP email. Check SMTP configuration and try again."}), 502

        return jsonify({"success": True, "requires_otp": True,
                        "email": user["email"],
                        "message": "Verification code sent to your registered email."})
    except Exception:
        if connection is not None:
            connection.rollback()
        app.logger.exception("Login request failed")
        return jsonify({"success": False, "message": "Unable to log in right now."}), 500
    finally:
        if cursor is not None: cursor.close()
        if connection is not None and connection.is_connected(): connection.close()


@app.route("/api/auth/verify-login-otp", methods=["POST"])
def verify_login_otp():
    """Only return the user session payload after a valid login OTP."""
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    otp = str(payload.get("otp", "")).strip()
    if not re.fullmatch(r"\d{6}", otp):
        return jsonify({"success": False, "message": "Enter the 6-digit OTP."}), 400

    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        ensure_login_otp_table(cursor)
        cursor.execute(
            "SELECT id, full_name, email, role FROM users "
            "WHERE LOWER(email) = %s AND is_active = 1 LIMIT 1", (email,)
        )
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "Invalid or expired OTP. Request a new login code."}), 400

        cursor.execute(
            "SELECT id, otp_hash, expires_at, attempts, used FROM login_otps "
            "WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user["id"],)
        )
        record = cursor.fetchone()
        if (not record or record["used"] or record["attempts"] >= OTP_MAX_ATTEMPTS
                or record["expires_at"] < datetime.utcnow()):
            return jsonify({"success": False, "message": "Invalid or expired OTP. Request a new login code."}), 400
        if not secrets.compare_digest(record["otp_hash"], hash_otp(otp)):
            cursor.execute("UPDATE login_otps SET attempts = attempts + 1 WHERE id = %s", (record["id"],))
            connection.commit()
            return jsonify({"success": False, "message": "Invalid or expired OTP."}), 400

        role_map = {"Admin": "admin", "IT Security Admin": "admin",
                    "FGV Management": "fgv", "FELDA Management": "felda"}
        if user["role"] not in role_map:
            return jsonify({"success": False, "message": "This account has an unsupported role. Contact the administrator."}), 403
        cursor.execute("UPDATE login_otps SET used = 1 WHERE id = %s", (record["id"],))
        connection.commit()
        return jsonify({"success": True, "user": make_session_user(user)})
    except Exception:
        if connection is not None:
            connection.rollback()
        app.logger.exception("Login OTP verification failed")
        return jsonify({"success": False, "message": "Unable to verify login OTP right now."}), 500
    finally:
        if cursor is not None: cursor.close()
        if connection is not None and connection.is_connected(): connection.close()

@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        return jsonify({"success": False, "message": "Enter a valid email address."}), 400

    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        ensure_password_reset_table(cursor)
        cursor.execute("SELECT id, email FROM users WHERE LOWER(email) = %s AND is_active = 1 LIMIT 1", (email,))
        user = cursor.fetchone()
        # Do not send reset emails to placeholder domains; preserve generic response.
        if user and is_placeholder_email(user["email"]):
            user = None
        # Do not disclose whether an account exists. Send only for active registered accounts.
        if user:
            otp = f"{secrets.randbelow(1_000_000):06d}"
            cursor.execute("UPDATE password_reset_otps SET used = 1 WHERE user_id = %s AND used = 0", (user["id"],))
            cursor.execute(
                "INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES (%s, %s, %s)",
                (user["id"], hash_otp(otp), datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES))
            )
            connection.commit()
            try:
                send_otp_email(user["email"], otp)
            except Exception:
                app.logger.exception("Failed to send password reset email")
                cursor.execute("UPDATE password_reset_otps SET used = 1 WHERE user_id = %s AND used = 0", (user["id"],))
                connection.commit()
                return jsonify({"success": False, "message": "Unable to send OTP email. Check SMTP configuration and try again."}), 502
        return jsonify({"success": True, "message": "If an active account matches that email, an OTP has been sent."})
    except Exception:
        app.logger.exception("Forgot password request failed")
        return jsonify({"success": False, "message": "Unable to process the request right now."}), 500
    finally:
        if cursor is not None: cursor.close()
        if connection is not None and connection.is_connected(): connection.close()

@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_reset_otp():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    otp = str(payload.get("otp", "")).strip()
    if not re.fullmatch(r"\d{6}", otp):
        return jsonify({"success": False, "message": "Enter the 6-digit OTP."}), 400
    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        ensure_password_reset_table(cursor)
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = %s AND is_active = 1 LIMIT 1", (email,))
        user = cursor.fetchone()
        if not user: return jsonify({"success": False, "message": "Invalid or expired OTP."}), 400
        cursor.execute("SELECT id, otp_hash, expires_at, attempts, used FROM password_reset_otps WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user["id"],))
        record = cursor.fetchone()
        if not record or record["used"] or record["attempts"] >= OTP_MAX_ATTEMPTS or record["expires_at"] < datetime.utcnow():
            return jsonify({"success": False, "message": "Invalid or expired OTP. Request a new code."}), 400
        if not secrets.compare_digest(record["otp_hash"], hash_otp(otp)):
            cursor.execute("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = %s", (record["id"],))
            connection.commit()
            return jsonify({"success": False, "message": "Invalid or expired OTP."}), 400
        # Verification is checked again during reset; OTP is not consumed until password is changed.
        return jsonify({"success": True, "message": "OTP verified."})
    except Exception:
        app.logger.exception("OTP verification failed")
        return jsonify({"success": False, "message": "Unable to verify OTP right now."}), 500
    finally:
        if cursor is not None: cursor.close()
        if connection is not None and connection.is_connected(): connection.close()

@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email", "")).strip().lower()
    otp = str(payload.get("otp", "")).strip()
    password = str(payload.get("password", ""))
    if not re.fullmatch(r"\d{6}", otp): return jsonify({"success": False, "message": "Enter a valid OTP."}), 400
    if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return jsonify({"success": False, "message": "Password must be at least 8 characters and include a letter and a number."}), 400
    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        ensure_password_reset_table(cursor)
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = %s AND is_active = 1 LIMIT 1", (email,))
        user = cursor.fetchone()
        if not user: return jsonify({"success": False, "message": "Invalid or expired OTP."}), 400
        cursor.execute("SELECT id, otp_hash, expires_at, attempts, used FROM password_reset_otps WHERE user_id = %s ORDER BY id DESC LIMIT 1", (user["id"],))
        record = cursor.fetchone()
        if not record or record["used"] or record["attempts"] >= OTP_MAX_ATTEMPTS or record["expires_at"] < datetime.utcnow() or not secrets.compare_digest(record["otp_hash"], hash_otp(otp)):
            return jsonify({"success": False, "message": "Invalid or expired OTP. Request a new code."}), 400
        cursor.execute("UPDATE users SET password_hash = %s WHERE id = %s", (generate_password_hash(password), user["id"]))
        cursor.execute("UPDATE password_reset_otps SET used = 1 WHERE id = %s", (record["id"],))
        connection.commit()
        return jsonify({"success": True, "message": "Password updated. You can now log in with your account email and new password."})
    except Exception:
        if connection is not None: connection.rollback()
        app.logger.exception("Password reset failed")
        return jsonify({"success": False, "message": "Unable to reset password right now."}), 500
    finally:
        if cursor is not None: cursor.close()
        if connection is not None and connection.is_connected(): connection.close()


# =====================================================
# PROFILE UPDATE API — persist profile changes to MySQL
# =====================================================
@app.route("/api/profile", methods=["PUT"])
def update_profile():
    """Update the logged-in user's name, email and phone where the schema supports it.

    The role is intentionally not accepted from the client. This endpoint follows the
    current prototype's browser-session model; production deployment should replace
    current_email identification with a server-validated session/JWT.
    """
    payload = request.get_json(silent=True) or {}
    current_email = str(payload.get("current_email", "")).strip().lower()
    name = re.sub(r"\s+", " ", str(payload.get("name", "")).strip())
    new_email = str(payload.get("email", "")).strip().lower()
    phone = str(payload.get("phone", "")).strip()

    if not current_email or not name or len(name) > 150:
        return jsonify({"success": False, "message": "A valid current account and full name are required."}), 400
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", new_email):
        return jsonify({"success": False, "message": "Enter a valid email address."}), 400
    if not re.fullmatch(r"\+60[0-9]{8,10}", re.sub(r"[\s-]", "", phone)):
        return jsonify({"success": False, "message": "Phone number must be +60 followed by 8–10 digits."}), 400

    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id, full_name, email, role FROM users WHERE LOWER(email) = %s AND is_active = 1 LIMIT 1", (current_email,))
        user = cursor.fetchone()
        if not user:
            return jsonify({"success": False, "message": "Account not found or inactive. Please log in again."}), 404

        cursor.execute("SELECT id FROM users WHERE LOWER(email) = %s AND id <> %s LIMIT 1", (new_email, user["id"]))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "That email address is already used by another account."}), 409

        # Detect optional phone column without altering the existing schema.
        cursor.execute("SHOW COLUMNS FROM users")
        columns = {str(row.get("Field", "")).lower() for row in cursor.fetchall()}
        phone_column = next((c for c in ("phone", "phone_number", "mobile") if c in columns), None)
        if phone_column:
            cursor.execute(
                f"UPDATE users SET full_name = %s, email = %s, `{phone_column}` = %s WHERE id = %s",
                (name, new_email, re.sub(r"[\s-]", "", phone), user["id"])
            )
        else:
            cursor.execute("UPDATE users SET full_name = %s, email = %s WHERE id = %s", (name, new_email, user["id"]))
        connection.commit()
        message = "Profile updated in MySQL."
        if not phone_column:
            message += " Name and email were saved, but this users table has no phone column, so phone remains local to this browser."
        return jsonify({"success": True, "message": message, "user": {
            "id": user["id"], "name": name, "email": new_email,
            "phone": re.sub(r"[\s-]", "", phone) if phone_column else None
        }})
    except Exception:
        if connection is not None:
            connection.rollback()
        app.logger.exception("Profile update failed")
        return jsonify({"success": False, "message": "Unable to update profile in MySQL right now."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


# =====================================================
# ADMIN USER MANAGEMENT API — MySQL users table
# =====================================================
_ALLOWED_USER_ROLES = {"Admin", "FGV Management", "FELDA Management"}

def _ensure_user_phone_column(cursor):
    """Add an optional phone_number column if absent; additive migration only."""
    cursor.execute("SHOW COLUMNS FROM users")
    columns = {str(row.get("Field", "")).lower() for row in cursor.fetchall()}
    if "phone_number" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL")
    return "phone_number"


@app.route("/api/admin/users", methods=["GET"])
def admin_list_users():
    actor, error = require_admin()
    if error:
        return error
    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SHOW COLUMNS FROM users")
        columns = {str(row.get("Field", "")).lower() for row in cursor.fetchall()}
        if "phone_number" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL")
            columns.add("phone_number")
        selected = ["id", "full_name", "email", "phone_number", "role", "is_active"]
        if "created_at" in columns:
            selected.append("created_at")
        cursor.execute("SELECT " + ", ".join(f"`{col}`" for col in selected) + " FROM users ORDER BY id DESC")
        users = cursor.fetchall()
        for user in users:
            if "created_at" in user and hasattr(user["created_at"], "isoformat"):
                user["created_at"] = user["created_at"].isoformat(sep=" ")
            user["is_active"] = bool(user.get("is_active"))
        return jsonify({"success": True, "users": users})
    except Exception:
        app.logger.exception("Admin user list failed")
        return jsonify({"success": False, "message": "Unable to load users from MySQL."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()

@app.route("/api/admin/users", methods=["POST"])
def admin_create_user():
    actor, error = require_admin()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    full_name = re.sub(r"\s+", " ", str(payload.get("full_name", "")).strip())
    email = str(payload.get("email", "")).strip().lower()
    password = str(payload.get("password", ""))
    password_confirm = str(payload.get("password_confirm", ""))
    phone_number = str(payload.get("phone_number", "")).strip()[:30]
    role = str(payload.get("role", "")).strip()
    if not full_name or len(full_name) > 150:
        return jsonify({"success": False, "message": "Enter a name (maximum 150 characters)."}), 400
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        return jsonify({"success": False, "message": "Enter a valid email address."}), 400
    if len(password) < 12:
        return jsonify({"success": False, "message": "Password must contain at least 12 characters."}), 400
    if password != password_confirm:
        return jsonify({"success": False, "message": "Password and retype password do not match."}), 400
    if role not in _ALLOWED_USER_ROLES:
        return jsonify({"success": False, "message": "Select a valid role."}), 400

    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = %s LIMIT 1", (email,))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "That email address is already registered."}), 409
        cursor.execute("SHOW COLUMNS FROM users")
        columns = {str(row.get("Field", "")).lower() for row in cursor.fetchall()}
        if "phone_number" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL")
        cursor.execute(
            "INSERT INTO users (full_name, email, phone_number, password_hash, role, is_active) VALUES (%s, %s, %s, %s, %s, %s)",
            (full_name, email, phone_number or None, generate_password_hash(password), role, True)
        )
        connection.commit()
        return jsonify({"success": True, "message": "User account created successfully.", "user": {
            "id": cursor.lastrowid, "full_name": full_name, "email": email, "phone_number": phone_number, "role": role, "is_active": True
        }}), 201
    except Exception:
        if connection is not None:
            connection.rollback()
        app.logger.exception("Admin create user failed")
        return jsonify({"success": False, "message": "Unable to create the account. Check the users table schema and database connection."}), 500
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


@app.route("/api/admin/users/<int:user_id>", methods=["PUT"])
def admin_update_user(user_id):
    actor, error = require_admin()
    if error:
        return error
    payload = request.get_json(silent=True) or {}
    full_name = re.sub(r"\s+", " ", str(payload.get("full_name", "")).strip())
    email = str(payload.get("email", "")).strip().lower()
    phone_number = str(payload.get("phone_number", "")).strip()[:30]
    role = str(payload.get("role", "")).strip()
    is_active = payload.get("is_active", True)
    if not full_name or len(full_name) > 150:
        return jsonify({"success": False, "message": "Enter a name (maximum 150 characters)."}), 400
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        return jsonify({"success": False, "message": "Enter a valid email address."}), 400
    if role not in _ALLOWED_USER_ROLES:
        return jsonify({"success": False, "message": "Select a valid role."}), 400
    if int(actor.get("id", 0)) == user_id and (role != "Admin" or not bool(is_active)):
        return jsonify({"success": False, "message": "You cannot deactivate your own account or remove your own Admin role."}), 400
    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute("SELECT id FROM users WHERE LOWER(email)=%s AND id<>%s LIMIT 1", (email, user_id))
        if cursor.fetchone():
            return jsonify({"success": False, "message": "That email address is already registered."}), 409
        cursor.execute("SELECT id FROM users WHERE id=%s LIMIT 1", (user_id,))
        if not cursor.fetchone():
            return jsonify({"success": False, "message": "User not found."}), 404
        cursor.execute("SHOW COLUMNS FROM users")
        columns = {str(row.get("Field", "")).lower() for row in cursor.fetchall()}
        if "phone_number" not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL")
        cursor.execute("UPDATE users SET full_name=%s, email=%s, phone_number=%s, role=%s, is_active=%s WHERE id=%s", (full_name, email, phone_number or None, role, bool(is_active), user_id))
        connection.commit()
        return jsonify({"success": True, "message": "User updated successfully."})
    except Exception:
        if connection is not None: connection.rollback()
        app.logger.exception("Admin user update failed")
        return jsonify({"success": False, "message": "Unable to update user in MySQL."}), 500
    finally:
        if cursor is not None: cursor.close()
        if connection is not None and connection.is_connected(): connection.close()

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
def admin_deactivate_user(user_id):
    """Soft-delete user by setting is_active=0; never physically deletes account records."""
    actor, error = require_admin()
    if error:
        return error
    if int(actor.get("id", 0)) == user_id:
        return jsonify({"success": False, "message": "You cannot deactivate your own account."}), 400
    connection = cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("UPDATE users SET is_active=0 WHERE id=%s", (user_id,))
        if cursor.rowcount == 0:
            connection.rollback()
            return jsonify({"success": False, "message": "User not found or already inactive."}), 404
        connection.commit()
        return jsonify({"success": True, "message": "User deactivated. The record remains in MySQL."})
    except Exception:
        if connection is not None: connection.rollback()
        app.logger.exception("Admin user deactivation failed")
        return jsonify({"success": False, "message": "Unable to deactivate user in MySQL."}), 500
    finally:
        if cursor is not None: cursor.close()
        if connection is not None and connection.is_connected(): connection.close()

# =====================================================
# 1. HOME API
# =====================================================
@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "FGV Prodata Security Dashboard API",
        "status": "running"
    })


# =====================================================
# 2. GET ENDPOINTS FROM MYSQL
# =====================================================
@app.route("/api/endpoints", methods=["GET"])
def get_endpoints():
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT * FROM endpoints")
        endpoints = cursor.fetchall()

        return jsonify(endpoints)

    except Exception:
        app.logger.exception("Failed to retrieve endpoints")

        return jsonify({
            "error": "Failed to retrieve endpoint data"
        }), 500

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


# =====================================================
# 3. READ IMPORT BATCHES AND THEIR ROWS FROM MYSQL
# =====================================================
@app.route("/api/import-batches", methods=["GET"])
def get_import_batches():
    """Return saved import batches and decoded rows for the dashboard viewer."""
    module_key = request.args.get("module_key")
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        if module_key:
            cursor.execute(
                "SELECT id, module_key, file_name, record_count, imported_at "
                "FROM import_batches WHERE module_key = %s ORDER BY id DESC",
                (module_key,)
            )
        else:
            cursor.execute(
                "SELECT id, module_key, file_name, record_count, imported_at "
                "FROM import_batches ORDER BY id DESC"
            )
        batches = cursor.fetchall()

        for batch in batches:
            cursor.execute(
                "SELECT excel_row_number, record_data FROM imported_records "
                "WHERE batch_id = %s ORDER BY excel_row_number ASC",
                (batch["id"],)
            )
            rows = cursor.fetchall()
            decoded_rows = []
            for row in rows:
                raw = row.get("record_data")
                try:
                    record = json.loads(raw) if isinstance(raw, str) else raw
                except (TypeError, json.JSONDecodeError):
                    record = {"record_data": str(raw)}
                decoded_rows.append({
                    "excel_row_number": row.get("excel_row_number"),
                    "data": record if isinstance(record, dict) else {"value": record}
                })

            batch["records"] = decoded_rows
            imported_at = batch.get("imported_at")
            batch["imported_at"] = imported_at.isoformat(sep=" ") if hasattr(imported_at, "isoformat") else imported_at

        return jsonify({"success": True, "batches": batches})

    except Exception:
        app.logger.exception("Failed to retrieve import batches")
        return jsonify({"success": False, "message": "Failed to retrieve import data from MySQL."}), 500

    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


# =====================================================
# 4. IMPORT EXCEL DATA INTO MYSQL
# =====================================================
@app.route("/api/import-excel", methods=["POST"])
def import_excel_to_mysql():
    payload = request.get_json(silent=True) or {}

    module_key = payload.get("moduleKey")
    file_name = payload.get("fileName")
    records = payload.get("records")

    # Validate the incoming data
    if not isinstance(module_key, str) or not module_key.strip():
        return jsonify({
            "success": False,
            "message": "A valid module key is required."
        }), 400

    if not isinstance(file_name, str) or not file_name.strip():
        return jsonify({
            "success": False,
            "message": "A valid file name is required."
        }), 400

    if not isinstance(records, list) or not records:
        return jsonify({
            "success": False,
            "message": "No records provided."
        }), 400

    if not all(isinstance(record, dict) for record in records):
        return jsonify({
            "success": False,
            "message": "Each record must be an object."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Create an import batch
        cursor.execute(
            """
            INSERT INTO import_batches
                (module_key, file_name, record_count)
            VALUES (%s, %s, %s)
            """,
            (
                module_key.strip(),
                file_name.strip(),
                len(records)
            )
        )

        batch_id = cursor.lastrowid

        # Prepare each Excel row for storage as JSON
        values = [
            (
                batch_id,
                row_number,
                json.dumps(record, ensure_ascii=False)
            )
            for row_number, record in enumerate(records, start=1)
        ]

        # Save all records under the same batch
        cursor.executemany(
            """
            INSERT INTO imported_records
                (batch_id, excel_row_number, record_data)
            VALUES (%s, %s, %s)
            """,
            values
        )

        # Commit only when all inserts succeed
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Import saved successfully.",
            "batchId": batch_id,
            "moduleKey": module_key,
            "fileName": file_name,
            "count": len(records)
        }), 201

    except Exception:
        if connection is not None:
            connection.rollback()

        app.logger.exception("Excel import failed")

        return jsonify({
            "success": False,
            "message": "Failed to save import data to MySQL."
        }), 500

    finally:
        if cursor is not None:
            cursor.close()

        if connection is not None and connection.is_connected():
            connection.close()


# =====================================================
# 5. RUN FLASK SERVER
# =====================================================
if __name__ == "__main__":
    app.run(debug=True, port=5000)
