import { treaty } from "@elysiajs/eden";
import type { App } from "@intelliflow/backend";

export const api = treaty<App>(window.location.origin, {
  fetch: {
    credentials: "omit",
  },
  headers: () => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  },
});
