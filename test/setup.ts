import "@testing-library/jest-dom";

// Mock environment variables for testing
process.env.AUTH_SECRET = "spendly-test-auth-secret-key-32-chars-long";
process.env.MONGODB_URI = "mongodb://localhost:27017/spendly_test";
