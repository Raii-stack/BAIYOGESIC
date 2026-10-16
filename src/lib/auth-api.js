const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function request(path, body) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}/api/auth/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("Unable to reach the authentication service. Check your connection and try again.");
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The authentication service returned an invalid response.");
  }

  if (!response.ok || result?.success === false) {
    throw new Error(
      result?.error?.message || result?.message || "The request could not be completed.",
    );
  }

  return result?.data;
}

export async function loginRequest({ email, password }) {
  const data = await request("login", { email, password });
  if (!data?.user) {
    throw new Error("The authentication service did not return a user.");
  }

  return data.user;
}

export async function registerRequest({ firstName, lastName, email }) {
  const data = await request("register", { firstName, lastName, email });
  if (!data?.user) {
    throw new Error("The authentication service did not confirm the registration.");
  }

  return data.user;
}

export async function logoutRequest() {
  await request("logout");
}
