import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test } from "vitest"
import { notifyToast } from "../../lib/toast"
import ToastHost from "./ToastHost"

afterEach(cleanup)

test("shows and dismisses shared success and error notifications", async () => {
  const user = userEvent.setup()
  render(<ToastHost />)
  notifyToast("Employee saved.")
  notifyToast("Unable to save employee.", "error")
  expect(await screen.findByRole("status")).toHaveTextContent("Employee saved")
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to save employee")
  await user.click(screen.getAllByRole("button", { name: "Dismiss notification" })[1])
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})
