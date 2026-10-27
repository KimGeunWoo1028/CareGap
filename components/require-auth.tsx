"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/lib/auth/session-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken, ready } = useAuthSession();
  const pathname = usePathname();

  useEffect(() => {
    if (!ready) return;
    if (!accessToken) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      window.location.replace(`/login${next}`);
    }
  }, [ready, accessToken, pathname]);

  if (!ready) {
    return (
      <div className="page-frame">
        <p className="muted">인증 상태를 확인하는 중…</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="page-frame">
        <p className="muted">로그인 화면으로 이동 중…</p>
      </div>
    );
  }

  return <>{children}</>;
}
