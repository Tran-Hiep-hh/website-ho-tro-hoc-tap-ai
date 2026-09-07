import { pool } from "../config/database.js";

export function createAuthRepository(database = pool) {
  return {
    async findUserByEmail(email) {
      const { rows } = await database.query("SELECT * FROM users WHERE LOWER(email) = $1", [email]);
      return rows[0];
    },
    async createUser({ fullName, email, passwordHash, role }) {
      const { rows } = await database.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [fullName, email, passwordHash, role],
      );
      return rows[0];
    },
    async createSession({ userId, sessionId, tokenHash, expiresAt }) {
      await database.query(
        `INSERT INTO refresh_tokens (user_id, session_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`, [userId, sessionId, tokenHash, expiresAt],
      );
    },
    async rotateSession({ userId, sessionId, oldHash, tokenHash, expiresAt }) {
      // A single conditional UPDATE lets only one request consume a refresh token.
      const { rows } = await database.query(
        `UPDATE refresh_tokens AS r SET token_hash = $4, expires_at = $5
         FROM users AS u
         WHERE r.user_id = u.user_id AND r.user_id = $1 AND r.session_id = $2
           AND r.token_hash = $3 AND NOT r.is_revoked AND r.expires_at > NOW()
           AND u.status = 'ACTIVE'
         RETURNING u.*`, [userId, sessionId, oldHash, tokenHash, expiresAt],
      );
      return rows[0];
    },
    async findSessionUser(userId, sessionId) {
      const { rows } = await database.query(
        `SELECT u.* FROM users u JOIN refresh_tokens r ON r.user_id = u.user_id
         WHERE u.user_id = $1 AND r.session_id = $2
           AND NOT r.is_revoked AND r.expires_at > NOW()`, [userId, sessionId],
      );
      return rows[0];
    },
    async revokeSession(userId, sessionId) {
      await database.query(
        "UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = $1 AND session_id = $2",
        [userId, sessionId],
      );
    },
  };
}
