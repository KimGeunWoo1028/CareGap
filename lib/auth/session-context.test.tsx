/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import {
  AuthSessionProvider,
  useAuthSession,
} from "@/lib/auth/session-context";

const unsubscribe = vi.fn();
let authListener:
  | ((event: string, session: { access_token: string; user: { id: string } } | null) => void)
  | null = null;

const signInWithPassword = vi.fn();
const authSignOut = vi.fn(async () => ({ error: null }));

vi.mock("@/lib/auth/browser", () => ({
  getBrowserAuthClient: () => ({
    auth: {
      onAuthStateChange: (
        cb: (
          event: string,
          session: { access_token: string; user: { id: string } } | null,
        ) => void,
      ) => {
        authListener = cb;
        return { data: { subscription: { unsubscribe } } };
      },
    },
  }),
  signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
  signOut: (...args: unknown[]) => authSignOut(...args),
}));

function Probe({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useAuthSession>) => void;
}) {
  const api = useAuthSession();
  onReady(api);
  return (
    <div>
      <span data-testid="token">{api.accessToken ?? "none"}</span>
      <span data-testid="user">{api.user?.id ?? "none"}</span>
    </div>
  );
}

function waitFor(predicate: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) resolve();
      else if (Date.now() - start > ms) reject(new Error("waitFor timeout"));
      else setTimeout(tick, 10);
    };
    tick();
  });
}

describe("AuthSessionProvider token sync", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useAuthSession> | null = null;

  beforeEach(() => {
    authListener = null;
    unsubscribe.mockReset();
    signInWithPassword.mockReset();
    authSignOut.mockReset();
    authSignOut.mockResolvedValue({ error: null });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("updates accessToken on TOKEN_REFRESHED without requiring reload", async () => {
    await act(async () => {
      root.render(
        <AuthSessionProvider>
          <Probe onReady={(api) => {
            latest = api;
          }} />
        </AuthSessionProvider>,
      );
    });
    await waitFor(() => authListener != null);

    await act(async () => {
      authListener?.("TOKEN_REFRESHED", {
        access_token: "refreshed-token",
        user: { id: "user-1" },
      });
    });

    await waitFor(
      () => container.querySelector("[data-testid=token]")?.textContent ===
        "refreshed-token",
    );
    expect(latest?.accessToken).toBe("refreshed-token");
    expect(latest?.user?.id).toBe("user-1");
  });

  it("clears session on SIGNED_OUT and after logout", async () => {
    await act(async () => {
      root.render(
        <AuthSessionProvider>
          <Probe onReady={(api) => {
            latest = api;
          }} />
        </AuthSessionProvider>,
      );
    });
    await waitFor(() => authListener != null);

    await act(async () => {
      authListener?.("SIGNED_IN", {
        access_token: "login-token",
        user: { id: "user-1" },
      });
    });
    await waitFor(
      () => container.querySelector("[data-testid=token]")?.textContent ===
        "login-token",
    );

    await act(async () => {
      await latest!.signOut();
    });
    expect(authSignOut).toHaveBeenCalled();
    expect(latest?.accessToken).toBeNull();

    await act(async () => {
      authListener?.("TOKEN_REFRESHED", {
        access_token: "should-clear",
        user: { id: "user-1" },
      });
      authListener?.("SIGNED_OUT", null);
    });
    expect(latest?.accessToken).toBeNull();
  });

  it("signIn stores the session token from password grant", async () => {
    signInWithPassword.mockResolvedValue({
      session: {
        access_token: "password-token",
        user: { id: "user-a" },
      },
      user: { id: "user-a" },
      error: null,
    });

    await act(async () => {
      root.render(
        <AuthSessionProvider>
          <Probe onReady={(api) => {
            latest = api;
          }} />
        </AuthSessionProvider>,
      );
    });

    let result: { ok: true } | { ok: false; message: string } | null = null;
    await act(async () => {
      result = await latest!.signIn("a@example.invalid", "secret");
    });
    expect(result).toEqual({ ok: true });
    expect(latest?.accessToken).toBe("password-token");
  });

  it("unsubscribes auth listener on unmount", async () => {
    await act(async () => {
      root.render(
        <AuthSessionProvider>
          <Probe onReady={() => undefined} />
        </AuthSessionProvider>,
      );
    });
    await waitFor(() => authListener != null);
    await act(async () => {
      root.unmount();
    });
    expect(unsubscribe).toHaveBeenCalled();
  });
});
