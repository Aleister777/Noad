import type { Metadata } from "next";
import {
  Inter, Lato, Poppins, Roboto, Merriweather,
  Playfair_Display, Source_Code_Pro, DM_Sans, Raleway, Nunito,
} from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Noad",
};

const inter        = Inter({ subsets: ["latin"], variable: "--font-inter",       display: "swap" });
const lato         = Lato({ subsets: ["latin"], variable: "--font-lato",         display: "swap", weight: ["400", "700"] });
const poppins      = Poppins({ subsets: ["latin"], variable: "--font-poppins",   display: "swap", weight: ["400", "600", "700"] });
const roboto       = Roboto({ subsets: ["latin"], variable: "--font-roboto",     display: "swap", weight: ["400", "700"] });
const merriweather = Merriweather({ subsets: ["latin"], variable: "--font-merriweather", display: "swap", weight: ["400", "700"] });
const playfair     = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const sourceCode   = Source_Code_Pro({ subsets: ["latin"], variable: "--font-source-code", display: "swap" });
const dmSans       = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans",   display: "swap" });
const raleway      = Raleway({ subsets: ["latin"], variable: "--font-raleway",   display: "swap" });
const nunito       = Nunito({ subsets: ["latin"], variable: "--font-nunito",     display: "swap" });

const ALL_FONTS = [inter, lato, poppins, roboto, merriweather, playfair, sourceCode, dmSans, raleway, nunito];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontClasses = ALL_FONTS.map(f => f.variable).join(" ");
  return (
    <html lang="en" className={fontClasses}>
      <body suppressHydrationWarning style={{ margin: 0, padding: 0, overflow: "hidden" }}>
        {children}
      </body>
    </html>
  );
}
