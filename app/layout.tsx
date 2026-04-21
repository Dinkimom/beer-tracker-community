import type { Metadata } from "next";

import { Geist, Geist_Mono, Caveat } from "next/font/google";

import { DEFAULT_LANGUAGE } from "@/lib/i18n/model";
import { translate } from "@/lib/i18n/translator";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "react-hot-toast";

import { AuthGuard } from "@/components/AuthGuard";
import { DisableContextMenu } from "@/components/DisableContextMenu";
import { QueryProvider } from "@/components/QueryProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";

import { ThemeProvider } from "./ThemeProvider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Beer Tracker",
  description: translate(DEFAULT_LANGUAGE, "rootMeta.description"),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          // Скрипт предотвращает мерцание темы (FOUC) при первой загрузке
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('beer-tracker-theme');
                  if (theme) {
                    const parsed = JSON.parse(theme);
                    if (parsed === 'dark') {
                      document.documentElement.classList.add('dark');
                    } else {
                      document.documentElement.classList.remove('dark');
                    }
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
          suppressHydrationWarning
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} antialiased`}
      >
        <DisableContextMenu />
        <QueryProvider>
          <NuqsAdapter>
            <ThemeProvider>
              <LanguageProvider>
                <AuthGuard>
                  {children}
                  <Toaster
                    position="top-center"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        background: 'var(--toast-bg)',
                        color: 'var(--toast-fg)',
                      },
                      success: {
                        duration: 3000,
                        iconTheme: {
                          primary: "#10b981",
                          secondary: "#fff",
                        },
                      },
                      error: {
                        duration: 5000,
                        iconTheme: {
                          primary: "#ef4444",
                          secondary: "#fff",
                        },
                      },
                    }}
                  />
                </AuthGuard>
              </LanguageProvider>
            </ThemeProvider>
          </NuqsAdapter>
        </QueryProvider>
      </body>
    </html>
  );
}
