"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "@/lib/auth/session-context";

export default function HomePage() {
  const { accessToken, ready } = useAuthSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(accessToken ? "/cases" : "/login");
  }, [ready, accessToken, router]);

  return (
    <main className="page-frame">
      <p className="muted">화면을 준비하는 중…</p>
    </main>
  );
}
