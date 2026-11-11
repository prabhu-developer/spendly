import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { vi } from "vitest";
import { createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth/session";

let mongod: MongoMemoryServer | null = null;

/** Start an isolated mongod and point the app's connection helper at it. */
export async function startDb() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB_NAME = "spendly_it";
  // Reset the app's cached connection so it reconnects to this server
  (globalThis as { mongooseCache?: unknown }).mongooseCache = { conn: null, promise: null };
  // Deterministic FX: force the exchange-rate provider to fail → built-in fallback rates
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network disabled in tests")));
  const { connectToDatabase } = await import("@/lib/db/mongodb");
  await connectToDatabase();
  // Build declared indexes (unique clientRequestId etc.) before tests rely on them
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function stopDb() {
  await mongoose.disconnect();
  await mongod?.stop();
  vi.unstubAllGlobals();
}

export async function clearDb() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export interface TestUser {
  id: string;
  token: string;
  objectId: mongoose.Types.ObjectId;
}

export async function createUser(email: string, preferredCurrency = "USD"): Promise<TestUser> {
  const { User } = await import("@/models/User");
  const user = await User.create({ name: email.split("@")[0], email, passwordHash: "x".repeat(60), preferredCurrency });
  const token = await createSessionToken({
    userId: user._id.toString(),
    email,
    name: user.name,
    preferredCurrency: preferredCurrency as "USD",
    sv: 0,
  });
  return { id: user._id.toString(), token, objectId: user._id };
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Invoke a route handler like the framework would, as a given user. */
export async function call(
  handler: unknown,
  opts: { method?: string; path: string; user?: TestUser; body?: unknown; params?: Record<string, string> }
) {
  const headers: Record<string, string> = { origin: "http://localhost", "content-type": "application/json" };
  if (opts.user) headers.cookie = `${AUTH_COOKIE_NAME}=${opts.user.token}`;
  const req = new NextRequest(new URL(opts.path, "http://localhost"), {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}
