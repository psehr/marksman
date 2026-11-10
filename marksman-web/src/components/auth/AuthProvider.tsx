"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@marksman/contracts";
import { checkAlphaAccess, getCurrentUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  alphaAccess: AlphaAccess;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AlphaAccess = "unknown" | "allowed" | "denied";

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [alphaAccess, setAlphaAccess] = useState<AlphaAccess>("unknown");
  const refreshId = useRef(0);

  const refreshUser = useCallback(async () => {
    const requestId = ++refreshId.current;
    setLoading(true);
    setError(null);
    setAlphaAccess("unknown");

    try {
      const currentUser: User = await getCurrentUser();
      if (requestId !== refreshId.current) return;
      setUser(currentUser);

      await checkAlphaAccess();
      if (requestId !== refreshId.current) return;
      setAlphaAccess("allowed");
    } catch (error) {
      if (requestId !== refreshId.current) return;
      if (
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === "ALPHA_ACCESS_REQUIRED"
      ) {
        setAlphaAccess("denied");
        return;
      }

      setUser(null);
      if (error instanceof ApiError && error.status === 401) return;

      setError("Could not check your session. Please try again.");
    } finally {
      if (requestId === refreshId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshUser();

    return () => {
      refreshId.current++;
    };
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{ user, loading, error, refreshUser, alphaAccess }}
    >
      {children}
    </AuthContext.Provider>
  );
}
