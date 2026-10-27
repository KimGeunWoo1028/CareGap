"use client";

import Link from "next/link";
import { useAuthSession } from "@/lib/auth/session-context";

type AppHeaderProps = {
  onSignOut?: () => void;
};

export function AppHeader({ onSignOut }: AppHeaderProps) {
  const { user, signOut } = useAuthSession();

  async function handleSignOut() {
    await signOut();
    onSignOut?.();
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Link href="/cases" className="app-header__title">
          돌봄틈새 AI
        </Link>
        <span className="app-header__subtitle">상담 기록 비교 보조</span>
      </div>
      <div className="app-header__meta">
        {user?.email ? (
          <p className="app-header__account">
            <span className="visually-hidden">로그인 계정 </span>
            {user.email}
          </p>
        ) : null}
        <button type="button" className="btn btn--ghost" onClick={handleSignOut}>
          로그아웃
        </button>
      </div>
    </header>
  );
}
