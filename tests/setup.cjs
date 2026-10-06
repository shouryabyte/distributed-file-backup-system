process.env.DATABASE_URL ||= 'postgres://backup:test@localhost:5432/backup';
process.env.JWT_SECRET ||= 'test-jwt-secret-at-least-16';
process.env.INTERNAL_TOKEN ||= 'test-internal-token-at-least-16';
