import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slingshot — Little bird. Big energy.",
  description: "A little bird, a big adventure. Pull, aim, and topple the tower in this free slingshot physics game.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6f0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <noscript><p className="fixed left-1/2 top-5 -translate-x-1/2 bg-card p-5">Please enable JavaScript to play Slingshot.</p></noscript>
      </body>
    </html>
  );
}
