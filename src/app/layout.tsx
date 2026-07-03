import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import VeroChat from "@/app/components/VeroChat";
import "./globals.css";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Vero360 — One app. Everything.",
  description: "Vero360 is Malawi's all-in-one super app for marketplace, Vero Ride, courier, food, accommodation, jobs, and more.",
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <VeroChat />
      </body>
    </html>
  );
}
