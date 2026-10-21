
import re
from getpass import getpass

from database import get_db_connection
from werkzeug.security import generate_password_hash


ALLOWED_ROLES = {
    "Admin",
    "FGV Management",
    "FELDA Management"
}


def is_allowed_email(email):
    """Accept any email address with a valid basic email format."""
    email = email.strip().lower()

    # Basic email format validation; no specific domain restriction.
    return bool(
        re.fullmatch(
            r"[^@\s]+@[^@\s]+\.[^@\s]+",
            email
        )
    )


def create_user():
    print("===================================")
    print(" FGV Prodata - Create User Account")
    print("===================================")

    full_name = input("Full name: ").strip()
    email = input("Email address: ").strip().lower()

    # Validate email format
    if not is_allowed_email(email):
        print(
            "\nRegistration failed: "
            "Please enter a valid email address."
        )
        return

    # Validate required fields
    if not full_name:
        print("\nRegistration failed: Full name is required.")
        return

    password = getpass("Password: ")
    confirm_password = getpass("Confirm password: ")

    if not password:
        print("\nRegistration failed: Password is required.")
        return

    # Validate password
    if len(password) < 12:
        print(
            "\nRegistration failed: "
            "Password must contain at least 12 characters."
        )
        return

    if password != confirm_password:
        print("\nRegistration failed: Passwords do not match.")
        return

    # Select account role
    print("\nAvailable roles:")
    print("1. Admin")
    print("2. FGV Management")
    print("3. FELDA Management")

    role_choice = input("Select role (1-3): ").strip()

    role_mapping = {
        "1": "Admin",
        "2": "FGV Management",
        "3": "FELDA Management"
    }

    role = role_mapping.get(role_choice)

    if role not in ALLOWED_ROLES:
        print("\nRegistration failed: Invalid role.")
        return

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Check whether the email already exists
        cursor.execute(
            "SELECT id FROM users WHERE email = %s LIMIT 1",
            (email,)
        )

        if cursor.fetchone():
            print("\nRegistration failed: Email already registered.")
            return

        # Hash the password before saving
        password_hash = generate_password_hash(password)

        cursor.execute(
            """
            INSERT INTO users
                (full_name, email, password_hash, role, is_active)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (full_name, email, password_hash, role, True)
        )

        connection.commit()

        print("\nAccount created successfully!")
        print(f"Name: {full_name}")
        print(f"Email: {email}")
        print(f"Role: {role}")

    except Exception as error:
        if connection and connection.is_connected():
            connection.rollback()

        print("\nFailed to create account.")
        print("Error:", error)

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    create_user()
