"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@marksman/contracts";
import { getCurrentUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/client";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

  const refreshUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const currentUser: User = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
      if (error instanceof ApiError && error.status === 401) {
        return;
      }

      setError("Could not check your session. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
