import type { Metadata } from "next";
import "../theme.css";
import "../index.css";
import "../game/hamster.css";

// next/font는 설치본의 한글 서브셋 데이터를 제공하지 않아(자호스팅 시 한글이
// 전부 폴백으로 남는다) Google Fonts 직결을 유지한다. 대신 CSS @import의
// 직렬 대기를 없애려고 <link>로 병렬 로딩하고 preconnect를 둔다.
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Jua&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400&display=swap"
        />
      </head>
      <body>
        <div id="boot-static" aria-hidden="true">
          <div className="boot-splash">
            <div className="home-mascot" aria-hidden="true">
              <img src="/hamster-mascot.svg" alt="" />
            </div>
            <h1 className="home-title" aria-hidden="true">
              hamsudoku
            </h1>
            <p className="home-sub" aria-hidden="true">
              숨은 햄스터를 찾아라
            </p>
            <div className="boot-actions" aria-hidden="true">
              <div className="boot-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
