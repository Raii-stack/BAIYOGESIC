import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthContext.jsx";

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("authentication forms", () => {
  it("submits registration details and explains pending approval", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          user: {
            id: 12,
            first_name: "Avery",
            last_name: "Stone",
            email: "avery@example.com",
            status: "pending",
          },
        },
      }, 201),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderApp();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.type(screen.getByLabelText("First name"), " Avery ");
    await user.type(screen.getByLabelText("Last name"), " Stone ");
    await user.type(screen.getByLabelText("Work email"), " AVERY@example.com ");
    await user.click(screen.getByRole("button", { name: "Submit account request" }));

    await screen.findByRole("status");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
          firstName: "Avery",
          lastName: "Stone",
          email: "avery@example.com",
        }),
      }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/after administrator approval/i);
  });

  it("logs in, retains the returned user in context, and signs out via the cookie API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            user: { id: 4, email: "member@example.com", role: "staff", status: "active" },
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { message: "Logged out" } }));
    vi.stubGlobal("fetch", fetchMock);

    renderApp();
    await user.type(screen.getByLabelText("Work email"), "member@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Welcome to your workspace" })).toBeVisible();
    expect(screen.getByText("member@example.com")).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ email: "member@example.com", password: "correct-horse" }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible());
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("shows a loading spinner and disables submission while the API is pending", async () => {
    const user = userEvent.setup();
    let resolveLogin;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveLogin = resolve;
          }),
      ),
    );

    renderApp();
    await user.type(screen.getByLabelText("Work email"), "member@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const submitButton = screen.getByRole("button", { name: "Signing in..." });
    expect(submitButton).toBeDisabled();
    expect(submitButton.querySelector('[aria-hidden="true"]')).toBeInTheDocument();

    resolveLogin(
      jsonResponse({
        success: true,
        data: { user: { id: 4, email: "member@example.com" } },
      }),
    );
    expect(await screen.findByRole("heading", { name: "Welcome to your workspace" })).toBeVisible();
  });

  it("shows API failures as accessible error notifications", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { success: false, error: { message: "Invalid email or password" } },
          401,
        ),
      ),
    );

    renderApp();
    await user.type(screen.getByLabelText("Work email"), "member@example.com");
    await user.type(screen.getByLabelText("Password"), "incorrect");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  });

  it("validates trimmed registration names before making an API request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderApp();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.type(screen.getByLabelText("First name"), "   ");
    await user.type(screen.getByLabelText("Last name"), "Stone");
    await user.type(screen.getByLabelText("Work email"), "avery@example.com");
    await user.click(screen.getByRole("button", { name: "Submit account request" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter your first name, last name, and work email.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
