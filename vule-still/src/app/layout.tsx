import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header, Footer } from "@/components/site-shell";
import "./globals.css";

const manrope = localFont({
  src: "../../public/fonts/manrope.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vule Still",
  description: "Vule Still — rezervacija termina u Zrenjaninu i Neuzinu.",
  icons: { icon: "/brand/favicon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="sr-Latn"
      className={`${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><a href="#main" className="skip-link">Preskoči na sadržaj</a><Header />{children}<Footer /></body>
    </html>
  );
}
