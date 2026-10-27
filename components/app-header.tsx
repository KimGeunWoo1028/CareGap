"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
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
    <header className="map-chrome">
      <div className="map-chrome__line" aria-hidden="true" />
      <div className="map-chrome__inner">
        <Link href="/cases" className="map-chrome__brand">
          <BrandMark className="map-chrome__mark" size={30} />
          <span className="map-chrome__titles">
            <span className="map-chrome__name">돌봄틈새 AI</span>
            <span className="map-chrome__line-id">상담 기록 비교 보조</span>
          </span>
        </Link>
        <div className="map-chrome__ops">
          {user?.email ? (
            <p className="map-chrome__account">
              <span className="visually-hidden">로그인 계정 </span>
              <span className="map-chrome__station-dot" aria-hidden="true" />
              {user.email}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost map-chrome__logout"
            onClick={handleSignOut}
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
