import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";

// Zodiak and Sentient by the Indian Type Foundry, from Fontshare (ITF Free Font License: free for commercial and web use).
export const zodiak = localFont({
  src: [
    { path: "../fonts/zodiak-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/zodiak-400i.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-zodiak",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const sentient = localFont({
  src: [
    { path: "../fonts/sentient-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/sentient-400i.woff2", weight: "400", style: "italic" },
    { path: "../fonts/sentient-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/sentient-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sentient",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const fontVars = `${zodiak.variable} ${sentient.variable} ${mono.variable}`;
