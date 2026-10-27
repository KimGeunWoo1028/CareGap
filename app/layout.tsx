import type { Metadata } from "next";
import { SyntheticDataBanner } from "@/components/synthetic-data-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "돌봄틈새 AI (CareGap AI) — MVP 골격",
  description:
    "합성 상담 기록 비교를 돕는 해커톤 MVP. 현재는 프로젝트 골격 단계입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <SyntheticDataBanner />
          {children}
        </div>
      </body>
    </html>
  );
}
