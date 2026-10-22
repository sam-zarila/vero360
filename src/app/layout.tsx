import type { Metadata } from "next";
import Script from "next/script";
import VeroChat from "@/app/components/VeroChat";
import { inter, plusJakartaSans } from "@/app/fonts";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-G9KMEJ6XQZ";

export const metadata: Metadata = {
  title: "Vero360 · One app. Everything.",
  description: "Vero360 is Malawi's all-in-one super app for marketplace, Vero Ride, courier, food, accommodation, jobs, and more.",
  icons: { icon: '/logo-white.png', apple: '/logo-white.png' },
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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
