import type { MetadataRoute } from "next";

// スマホの「ホーム画面に追加」で使われる名前とアイコン。
// displayは"browser"のままにしている（"standalone"にすると、iPhoneでGoogleログインの
// 画面遷移とCookieがアプリ表示側に引き継がれず、ログインできなくなることがあるため）。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "人工管理システム",
    short_name: "人工管理",
    description: "現場の打刻と人工の集計",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
