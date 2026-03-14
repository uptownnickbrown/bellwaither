import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meridian - School Quality Assessment Platform",
  description: "Framework-native school quality assessment and strategic planning platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
