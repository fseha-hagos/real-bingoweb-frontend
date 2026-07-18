import type { Metadata, Viewport } from "next";
import React from "react";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";
import AppShell from "../components/AppShell";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { am } from "../constants/amharic";

export const metadata: Metadata = {
  title: "ዊነር ቢንጎ!",
  description: am.metaDescription,
  keywords: ["bingo", "game", "ethiopia", "etb", "prize", "ቢንጎ", "ኢትዮጵያ"],
  authors: [{ name: am.metaAuthor }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="am">
      <body className="antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
          <ToastContainer
            position="top-center"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
            theme="dark"
          />
        </AuthProvider>
      </body>
    </html>
  );
}
