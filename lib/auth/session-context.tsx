"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  getBrowserAuthClient,
  signInWithPassword,
  signOut as authSignOut,
} from "@/lib/auth/browser";

export type AuthSessionState = {
  user: User | null;
  accessToken: string | null;
  ready: boolean;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
  clearSession: () => void;
};

const AuthSessionContext = createContext<AuthSessionState | null>(null);

function toSessionParts(session: Session | null) {
  return {
    user: session?.user ?? null,
    accessToken: session?.access_token ?? null,
  };
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
  }, []);

  const applySession = useCallback((session: Session | null) => {
    const parts = toSessionParts(session);
    setUser(parts.user);
    setAccessToken(parts.accessToken);
  }, []);

  // Keep React accessToken in sync with in-memory Supabase auto-refresh.
  // persistSession remains false — full page reload still requires re-login.
  useEffect(() => {
    const client = getBrowserAuthClient();
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {
        applySession(session);
        return;
      }
      if (event === "SIGNED_OUT") {
        clearSession();
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [applySession, clearSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await signInWithPassword(email, password);
      if (result.error || !result.session) {
        clearSession();
        return {
          ok: false as const,
          message: "로그인 정보를 확인해 주세요.",
        };
      }
      applySession(result.session);
      return { ok: true as const };
    },
    [applySession, clearSession],
  );

  const signOut = useCallback(async () => {
    await authSignOut();
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      ready,
      signIn,
      signOut,
      clearSession,
    }),
    [user, accessToken, ready, signIn, signOut, clearSession],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession(): AuthSessionState {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error("useAuthSession must be used within AuthSessionProvider");
  }
  return ctx;
}
