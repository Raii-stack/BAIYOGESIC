import { notifyToast } from "./toast"

type ErrorEnvelope = { success?: boolean; error?: { message?: string } }
const unsafe = /internal server error|database|postgres|sql|syntax error|relation |column |stack|at \S+\.js:\d+|duplicate key|violates|econn|configured|password_hash/i

export function safeApiMessage(status: number, response?: ErrorEnvelope | null): string {
  if (status === 401) return "Your session has expired. Please sign in again."
  if (status === 403) return response?.error?.message === "Change your password before continuing"
    ? "Change your password before continuing."
    : "You do not have permission to do that."
  if (status >= 500 || status === 0) return "The service is temporarily unavailable. Please try again."
  const detail = response?.error?.message?.trim()
  if ((status === 400 || status === 404 || status === 409) && detail && detail.length <= 160 && !unsafe.test(detail)) return detail
  return "That request could not be completed. Please try again."
}

export function safeErrorMessage(error: unknown) {
  return error instanceof Error && error.message.length <= 160 && !unsafe.test(error.message)
    ? error.message : "That request could not be completed. Please try again."
}

export function apiFailure(status: number, response?: ErrorEnvelope | null): Error {
  const message = safeApiMessage(status, response)
  if (status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("hope:session-expired"))
  notifyToast(message, "error")
  return new Error(message)
}
