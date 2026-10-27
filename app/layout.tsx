import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthSessionProvider } from "@/lib/auth/session-context";
import { StatusBanner } from "@/components/status-banner";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  display: "swap",
  weight: "45 920",
  fallback: ["Malgun Gothic", "sans-serif"],
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
    <html lang="ko" className={pretendard.variable}>
      <body>
        {/*
          THESIS: Quiet case-file desk for comparing two notes — refuse metric dashboards and AI-purple chrome.
          OWN-WORLD: Cool wash paper, teal actions, cool-gray ink, local Pretendard Variable (C+B).
          STORY: Sign in → own synthetic cases → add immutable notes → see analysis readiness.
          FIRST VIEWPORT: Persistent synthetic banner + branded top task chrome + primary work panel.
          FORM: Operate / restrained case-file desk / C+B redesign stage 1.
          FINISH: Stage 1 shared tokens/chrome only; screen redesigns follow later stages.
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
