import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Authentication — Amazon Cognito adapter seam.
 * Demo mode keeps a local session; production swaps `signIn`/`signUp` for
 * Cognito User Pool calls (SRP auth) and reads org/role from ID-token claims.
 */
export interface User {
  name: string;
  email: string;
  organisation: string;
  role: "Operations Manager" | "Warehouse Manager" | "Quality Inspector" | "Viewer";
}

interface AuthApi {
  user: User | null;
  signIn(email: string, password: string): Promise<{ ok: boolean; error?: string }>;
  signUp(u: User, password: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): void;
}

const KEY = "harvestquoin.session";
const Ctx = createContext<AuthApi | null>(null);

export const DEMO_USER: User = { name: "Hauwa Musa", email: "demo@harvestquoin.com", organisation: "Northern Fresh Aggregators Ltd", role: "Operations Manager" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  });

  const persist = (u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(KEY, JSON.stringify(u));
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  };

  const api: AuthApi = {
    user,
    async signIn(email, password) {
      await new Promise((r) => setTimeout(r, 450));
      if (password.length < 8) return { ok: false, error: "Incorrect email or password." };
      const known = email.toLowerCase() === DEMO_USER.email ? DEMO_USER : { ...DEMO_USER, email, name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
      persist(known);
      return { ok: true };
    },
    async signUp(u) {
      await new Promise((r) => setTimeout(r, 600));
      persist(u);
      return { ok: true };
    },
    signOut() {
      persist(null);
    },
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
