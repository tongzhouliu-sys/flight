import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FareRadar · 机票省钱雷达",
  description: "实时搜索航班，5 秒看懂：现在贵不贵、有没有更便宜的方案、推不推荐买。",
};

// 首屏前同步设置主题，避免深浅色闪烁（FOUC）。
const THEME_INIT = `(function(){try{var t=localStorage.getItem('fareradar:theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full md:h-screen md:overflow-hidden flex flex-col gradient-bg">
        <Nav />
        <main className="mx-auto w-full max-w-5xl px-4 py-4 md:py-6 flex-1 min-h-0">{children}</main>
      </body>
    </html>
  );
}
