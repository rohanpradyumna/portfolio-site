import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "@/styles/theme.css";
import "@/styles/globals.css";

// Fraunces - serif headings/name (variable, with optical-size axis)
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

// Inter - body text (variable)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// JetBrains Mono - code/mono UI (variable)
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rohanpradyumna.vercel.app"),
  title: "Rohan Pradyumna | AI Strategist & Consultant",
  description: "Personal portfolio of Rohan Pradyumna - AI strategist, consultant, and builder of developer tools.",
  keywords: ["AI", "strategist", "consultant", "developer tools", "portfolio"],
  authors: [{ name: "Rohan Pradyumna" }],
  openGraph: {
    title: "Rohan Pradyumna | AI Strategist & Consultant",
    description: "Personal portfolio of Rohan Pradyumna - AI strategist, consultant, and builder of developer tools.",
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Rohan Pradyumna",
    images: [
      {
        url: "/assets/og-card.jpg",
        width: 1200,
        height: 630,
        alt: "Rohan Pradyumna, AI Strategist & Consultant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rohan Pradyumna | AI Strategist & Consultant",
    description: "Personal portfolio of Rohan Pradyumna - AI strategist, consultant, and builder of developer tools.",
    images: ["/assets/og-card.jpg"],
  },
  icons: {
    icon: "/assets/icons/favicon-256.png",
    apple: "/assets/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
