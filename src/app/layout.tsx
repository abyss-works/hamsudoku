import type { Metadata } from "next";
import "../theme.css";
import "../index.css";
import "../game/hamster.css";

export const metadata: Metadata = {
  title: "hamsudoku",
  description: "귀여운 햄스터를 찾는 스도쿠 변형 퍼즐",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
