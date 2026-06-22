import type { Metadata } from "next";
import { Geist_Mono, Nunito, Shantell_Sans } from "next/font/google";
import { AppProviders } from "@/components/app-providers";
import { ThemeProvider, themeInitScript } from "@/components/theme-provider";
import "./globals.css";

const shantellSans = Shantell_Sans({
  variable: "--font-shantell",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SceneVault — a cozy home for your Excalidraw drawings",
    template: "%s · SceneVault",
  },
  description:
    "Keep every Excalidraw scene in one tidy, searchable library. Folders, autosave, and the full editor — no more drawings lost in your downloads.",
  applicationName: "SceneVault",
  openGraph: {
    title: "SceneVault — a cozy home for your Excalidraw drawings",
    description:
      "Folders, autosave, and the full Excalidraw editor in one tidy library.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${shantellSans.variable} ${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
