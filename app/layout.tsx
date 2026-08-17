import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppDataProvider } from "@/components/providers/AppDataProvider";
import { AppGate } from "@/components/providers/AppGate";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/Toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Unsmoke",
  description: "Private, local-first quit-smoking companion",
  applicationName: "Unsmoke",
  // Installed-to-home-screen behaviour on iOS, which reads none of the web
  // app manifest: `capable` drops Safari's chrome, and the translucent status
  // bar lets the canvas run under it (the layout already pads for
  // `env(safe-area-inset-top)`).
  appleWebApp: {
    capable: true,
    title: "Unsmoke",
    statusBarStyle: "black-translucent",
  },
  // Declaring `icons` at all replaces the `app/icon.svg` file convention's
  // auto-emitted tag, so `icon` has to be restated here alongside the
  // apple-touch raster iOS needs (it will not use an SVG).
  icons: {
    icon: "/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F4" },
    { media: "(prefers-color-scheme: dark)", color: "#101614" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppDataProvider>
          <AppShell>
            <AppGate>{children}</AppGate>
          </AppShell>
          <Toaster />
        </AppDataProvider>
      </body>
    </html>
  );
}
