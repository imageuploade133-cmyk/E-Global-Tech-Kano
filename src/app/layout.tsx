"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { ConfigProvider } from "@/lib/ConfigContext";
import { Toaster } from "sonner";
import { Bodoni_Moda, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bodoniModa.variable} ${hankenGrotesk.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=add_card,apps,arrow_back,arrow_forward,atm,campaign,cell_tower,chat,chevron_right,close,credit_card,diamond,expand_less,expand_more,face,gpp_maybe,headset_mic,history,lock_clock,notifications,power_settings_new,payments,real_estate_agent,receipt_long,search,send,sports_basketball,support_agent,tv"
        />
      </head>
      <body className="antialiased flex flex-col min-h-dvh">
        <ConfigProvider>
          <AuthProvider>
            <Toaster position="top-center" expand={false} richColors closeButton />
            {children}
          </AuthProvider>
        </ConfigProvider>
      </body>
    </html>
  );
}
