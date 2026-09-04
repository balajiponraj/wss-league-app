import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://wss-hub.vercel.app"),
  title: "WSS Badminton League",
  description: "WHITBY SMASH SQUAD badminton league, standings, fixtures, and playoff results.",
  icons: {
    icon: "/wss-shuttlecock-logo.png",
    shortcut: "/wss-shuttlecock-logo.png",
    apple: "/wss-shuttlecock-logo.png",
  },
  openGraph: {
    title: "WSS Badminton League",
    description: "WHITBY SMASH SQUAD badminton league, standings, fixtures, and playoff results.",
    url: "https://wss-hub.vercel.app",
    siteName: "WSS Badminton League",
    type: "website",
    images: [{ url: "/wss-shuttlecock-logo.png", width: 600, height: 338, alt: "WSS Badminton League shuttlecock" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "WSS Badminton League",
    description: "WHITBY SMASH SQUAD badminton league, standings, fixtures, and playoff results.",
    images: ["/wss-shuttlecock-logo.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
