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
  alternates: {
    canonical: "/",
  },
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

// Person structured data so search engines and AI answer engines can identify
// who this site belongs to, what he does, and where else he lives online.
const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Rohan Pradyumna",
  url: "https://rohanpradyumna.vercel.app",
  image: "https://rohanpradyumna.vercel.app/assets/og-card.jpg",
  jobTitle: "AI Strategist & Product Builder",
  worksFor: {
    "@type": "Organization",
    name: "Yottaflex",
  },
  alumniOf: {
    "@type": "CollegeOrUniversity",
    name: "Robert H. Smith School of Business, University of Maryland",
  },
  email: "mailto:pradyumnarohan@gmail.com",
  sameAs: ["https://www.linkedin.com/in/rohanpradyumna/"],
  description:
    "AI strategist, consultant, and builder of developer tools. Founded Intripid (AI travel app, 15K users, Antler-backed). Currently building YottaBuilder, an AI-powered SDLC platform.",
  knowsAbout: [
    "Artificial Intelligence",
    "Product Management",
    "AI Strategy",
    "SDLC Automation",
    "Startups",
    "Developer Tools",
  ],
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
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
        {children}
      </body>
    </html>
  );
}
