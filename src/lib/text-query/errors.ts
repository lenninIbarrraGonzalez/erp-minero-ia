import type { TextQueryError } from "./types";

export function makeError(
  code: TextQueryError["code"],
  message: string
): TextQueryError & Error {
  const err = new Error(message) as Error & TextQueryError;
  err.code = code;
  err.message = message;
  return err;
}

export const GENERIC_MINE_TERMS = new Set([
  "all",
  "todas",
  "todas las minas",
  "all mines",
  "minas",
  "mines",
  "every mine",
  "each mine",
  "cualquier mina",
  "cada mina",
]);
