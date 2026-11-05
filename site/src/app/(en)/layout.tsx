import type { Metadata, Viewport } from "next";
import "../globals.css";
import { fontVars } from "@/lib/fonts";
import { UI } from "@/content/i18n";
import { SITE_URL, ZENODO } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: UI.en.meta.title,
  description: UI.en.meta.description,
  alternates: { canonical: "/", languages: { en: "/", fr: "/fr/" } },
  openGraph: { title: UI.en.meta.title, description: UI.en.meta.description, url: "/", locale: "en_US", type: "article", images: ["/og.png"] },
  twitter: { card: "summary_large_image", title: UI.en.meta.title, description: UI.en.meta.description, images: ["/og.png"] },
  icons: { icon: "/favicon.svg" },
  other: {
    citation_title: ZENODO.title,
    citation_author: "Agueh, Adetayo",
    citation_publication_date: "2026/10/25",
    citation_doi: ZENODO.doi,
    citation_publisher: "Zenodo",
    citation_pdf_url: ZENODO.pdf,
  },
};

export const viewport: Viewport = { themeColor: "#f3efe6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars}>
      <body>{children}</body>
    </html>
  );
}
