import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "../src/contexts/auth-context";
import { MuiThemeProvider } from "../src/providers/mui-theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KgEdu - Knowledge Graph Education",
  description: "Educational platform for knowledge graph management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <MuiThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </MuiThemeProvider>
      </body>
    </html>
  );
}
