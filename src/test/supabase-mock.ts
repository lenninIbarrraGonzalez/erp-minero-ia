import { vi } from "vitest";

export type TableResult = { data: unknown[] | null; error: unknown };

/**
 * Creates a chainable Supabase query mock that supports the full chain used
 * across text-query and cost-variance tests: select, eq, ilike, like, gte, lt.
 */
export function makeChainableQuery(result: TableResult) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: (resolve: (val: typeof result) => unknown) => resolve(result),
  };
  return chain;
}

/**
 * Creates a Supabase client mock where each table returns a pre-defined result.
 * Falls back to { data: [], error: null } for unknown tables.
 */
export function makeSupabaseMock(
  tableResults: Record<string, TableResult>
) {
  return {
    from: vi.fn((table: string) =>
      makeChainableQuery(tableResults[table] ?? { data: [], error: null })
    ),
  };
}
