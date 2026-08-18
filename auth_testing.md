# AUTH TESTING PLAYBOOK

Step 1: MongoDB Verification
- Verify admin user exists in `users` collection
- Verify bcrypt hash starts with `$2b$`
- Indexes: users.email unique, login_attempts.identifier, password_reset_tokens.expires_at (TTL)

Step 2: API Testing
- POST /api/auth/register { email, password, name } — sets access_token + refresh_token httpOnly cookies
- POST /api/auth/login { email, password } — same cookies, returns user JSON
- GET /api/auth/me — returns user, requires cookies OR Authorization: Bearer
- POST /api/auth/logout — clears cookies
- POST /api/auth/refresh — refreshes access token from refresh_token cookie

Admin seed credentials are stored at /app/memory/test_credentials.md
