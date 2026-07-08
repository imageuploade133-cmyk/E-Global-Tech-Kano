import type { Metadata } from "next";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { Toaster } from "sonner";
import { RouteGuard } from "@/components/RouteGuard";

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni-moda",
  display: "swap",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "E-Tech Global Hub | Secure Digital Wallet",
  description: "Next-generation financial technology and secure digital banking.",
  icons: {
    icon: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body
        className={`${bodoniModa.variable} ${hankenGrotesk.variable} antialiased custom-scrollbar flex flex-col min-h-screen`}
      >
        <AuthProvider>
          <RouteGuard>
            {children}
          </RouteGuard>
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </body>
    </html>
  );
}
