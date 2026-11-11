import { isAxiosError } from "axios";

/** Extract a user-presentable message from an API error. */
export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isAxiosError(error)) {
    if (!error.response) return "You appear to be offline. Check your connection and try again.";
    const message = (error.response.data as { error?: unknown } | undefined)?.error;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return fallback;
}
