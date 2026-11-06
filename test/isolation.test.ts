import { describe, it, expect } from "vitest";

describe("Multi-User Data Isolation & Ownership", () => {
  const userA = { id: "user_a_123456", email: "alice@example.com" };
  const userB = { id: "user_b_789012", email: "bob@example.com" };

  interface MockRecord {
    id: string;
    userId: string;
    title: string;
    amount: number;
  }

  const mockDatabase: MockRecord[] = [
    { id: "tx_1", userId: userA.id, title: "Alice Salary", amount: 5000 },
    { id: "tx_2", userId: userA.id, title: "Alice Groceries", amount: 150 },
    { id: "tx_3", userId: userB.id, title: "Bob Freelance", amount: 2000 },
  ];

  function queryUserTransactions(sessionUserId: string): MockRecord[] {
    return mockDatabase.filter((rec) => rec.userId === sessionUserId);
  }

  function modifyTransaction(sessionUserId: string, txId: string, updates: Partial<MockRecord>) {
    const record = mockDatabase.find((rec) => rec.id === txId);
    if (!record) throw new Error("Not found");
    if (record.userId !== sessionUserId) {
      throw new Error("Unauthorized: Cross-user access rejected");
    }
    Object.assign(record, updates);
    return record;
  }

  it("ensures User A only queries User A's transactions", () => {
    const results = queryUserTransactions(userA.id);
    expect(results.length).toBe(2);
    expect(results.every((r) => r.userId === userA.id)).toBe(true);
    expect(results.some((r) => r.userId === userB.id)).toBe(false);
  });

  it("prevents User B from accessing User A's transactions", () => {
    const results = queryUserTransactions(userB.id);
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Bob Freelance");
    expect(results.some((r) => r.userId === userA.id)).toBe(false);
  });

  it("blocks cross-user mutation attempts with unauthorized error", () => {
    expect(() => {
      // User B attempts to edit User A's transaction tx_1
      modifyTransaction(userB.id, "tx_1", { amount: 999999 });
    }).toThrow("Unauthorized: Cross-user access rejected");

    // Verify record was NOT altered
    const record = mockDatabase.find((r) => r.id === "tx_1");
    expect(record?.amount).toBe(5000);
  });
});
