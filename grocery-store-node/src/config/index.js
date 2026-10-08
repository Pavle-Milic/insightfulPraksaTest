// Reads the configuration from environment variables (and from a ".env" file when there is one).
// This is the Node equivalent of application.properties.

try {
  // Loads ./.env into process.env. Variables that are already set in the real environment win.
  process.loadEnvFile();
} catch {
  // No .env file: perfectly fine, the defaults below are used.
}

const toBoolean = (value, fallback) => (value === undefined ? fallback : value.toLowerCase() === 'true');

export const config = {
  port: Number(process.env.PORT ?? 8080),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/Insightful_Test',
  jwt: {
    // Local-development default only: override it with the JWT_SECRET environment variable.
    secret: process.env.JWT_SECRET ?? 'insightful-grocery-store-dev-secret-key-change-me',
    expirationMinutes: Number(process.env.JWT_EXPIRATION_MINUTES ?? 60),
  },
  seed: {
    enabled: toBoolean(process.env.SEED_ENABLED, true),
    reset: toBoolean(process.env.SEED_RESET, false),
  },
};
