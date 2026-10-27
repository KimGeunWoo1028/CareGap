import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthSessionProvider } from "@/lib/auth/session-context";
import { StatusBanner } from "@/components/status-banner";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-ui",
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
          THESIS: Two consultation routes meet at an evidence interchange — not KPI dashboards or decorative maps.
          OWN-WORLD: Midnight enamel shell, porcelain work plates, scarlet/cobalt route accents only where previous↔current connect.
          STORY: Sign in on the night map → readable case deck → dual-route compare of synthetic notes.
          FIRST VIEWPORT: Synthetic strip + brand-forward night login (or porcelain app shell + primary work plate).
          FORM: Operate / Midnight Transit Diagram / seed 3ded0ac4 / challenger wayfinding-cartography-signage-midnight-transit-diagram.
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
