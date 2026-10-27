import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { AuthSessionProvider } from "@/lib/auth/session-context";
import { StatusBanner } from "@/components/status-banner";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "돌봄틈새 AI (CareGap AI)",
  description:
    "합성 상담 기록을 비교해 담당자 판단을 돕는 해커톤 MVP. 실제 자격 확정·자동 신청은 하지 않습니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={notoSansKr.variable}>
        {/*
          THESIS: Quiet case-file desk for comparing two notes — refuse metric dashboards and AI-purple chrome.
          OWN-WORLD: Cool mist paper, pine actions, charcoal ink, Noto Sans KR only.
          STORY: Sign in → own synthetic cases → add immutable notes → see analysis readiness.
          FIRST VIEWPORT: Persistent synthetic banner + branded top task chrome + primary work panel.
          FORM: Operate / restrained case-file desk / seed operate-desk-2026-10.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
        */}
        <AuthSessionProvider>
          <div className="app-root">
            <StatusBanner />
            {children}
          </div>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
