import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "@/styles/theme.css";
import "@/styles/globals.css";

// Instrument Serif - for headings
const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
  style: ["normal", "italic"],
});

// Geist Sans - body text
const geistSans = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

// Geist Mono - code/monospace
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rohan Pradyumna | AI Strategist & Consultant",
  description: "Personal portfolio of Rohan Pradyumna - AI strategist, consultant, and builder of developer tools.",
  keywords: ["AI", "strategist", "consultant", "developer tools", "portfolio"],
  authors: [{ name: "Rohan Pradyumna" }],
  openGraph: {
    title: "Rohan Pradyumna | AI Strategist & Consultant",
    description: "Personal portfolio of Rohan Pradyumna - AI strategist, consultant, and builder of developer tools.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rohan Pradyumna | AI Strategist & Consultant",
    description: "Personal portfolio of Rohan Pradyumna - AI strategist, consultant, and builder of developer tools.",
  },
  icons: {
    icon: "/assets/icons/Favicon.png",
    apple: "/assets/icons/Favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#faf7ef",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
