import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Noto_Sans_Georgian } from "next/font/google";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const notoGeorgian = Noto_Sans_Georgian({
  subsets: ["georgian"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-georgian",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "FLHUB",
  title: "FLHUB",
  description: "FLHUB — NGO Operations Dashboard",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { url: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      {
        url: "/apple-touch-icon-precomposed.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "FLHUB",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${notoGeorgian.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
