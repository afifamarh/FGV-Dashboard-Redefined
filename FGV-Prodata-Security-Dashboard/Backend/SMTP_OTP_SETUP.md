# Gmail SMTP OTP setup

1. In this folder, create a file named `.env` (do not name it `.env.txt`).
2. Add the following and replace the sample values with your own Gmail address and Google App Password:

   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_EMAIL=your-gmail-address@gmail.com
   SMTP_PASSWORD=your-16-character-app-password
   ```

3. Install dependencies in the same Python environment used for Flask:

   ```bash
   pip install -r requirements.txt
   ```

4. Ensure MySQL is running and the `fgv_security` database contains the `users` table with `id`, `full_name`, `email`, `password_hash`, `role`, and `is_active` columns.
5. Start the backend from this folder:

   ```bash
   python app.py
   ```

6. Open the dashboard through a local web server (not by double-clicking `index.html`) and use `http://127.0.0.1:5000` as the API host. The current JavaScript uses that address; change it if Flask runs elsewhere.
7. Forgot Password sends a six-digit OTP to active registered accounts. The OTP expires in five minutes and is limited to five attempts. The first request creates the `password_reset_otps` table automatically.

## Important

- Never share or commit `.env`; `.gitignore` excludes it.
- This implementation resets accounts in the MySQL `users` table. Demo accounts (`admin`, `fgv`, `felda`) remain browser-only and do not use MySQL password reset.
- Use HTTPS, CSRF protections, request throttling, and an organization-approved mail account before production deployment. This is a development prototype, not a complete production identity system.
