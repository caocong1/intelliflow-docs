import { type ParentComponent, createContext, createSignal, onMount, useContext } from "solid-js";
import { api } from "../api/client";

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
};

type AuthContextValue = {
  user: () => User | null;
  loading: () => boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
};

const AuthContext = createContext<AuthContextValue>();

export const AuthProvider: ParentComponent = (props) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [loading, setLoading] = createSignal(true);

  onMount(async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        const { data, error } = await api.api.auth.me.get();
        if (error || !data) {
          localStorage.removeItem("auth_token");
        } else {
          const me = data as { user: User };
          setUser(me.user);
        }
      } catch {
        localStorage.removeItem("auth_token");
      }
    }
    setLoading(false);
  });

  const login = async (
    username: string,
    password: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await api.api.auth.login.post({ username, password });

      if (error || !data) {
        const errData = error?.value as { error?: string } | undefined;
        return { success: false, error: errData?.error ?? "Login failed" };
      }

      const result = data as { token: string; user: User };
      localStorage.setItem("auth_token", result.token);
      setUser(result.user);
      return { success: true };
    } catch {
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await api.api.auth.logout.post();
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem("auth_token");
    setUser(null);
  };

  const isAdmin = () => user()?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
      {props.children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
