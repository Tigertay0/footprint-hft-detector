import { UI, type Locale } from "@/content/i18n";
import { ZENODO } from "@/lib/site";
import { LanguageSwitch } from "./ui/LanguageSwitch";

export function Footer({ locale, author }: { locale: Locale; author: string }) {
  const ui = UI[locale];
  return (
    <footer className="on-night bg-night text-night-text">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-16 md:grid-cols-[1fr_auto] md:px-8 md:py-20">
        <div>
          <p className="font-display text-[28px] tracking-[-0.01em]">{author}</p>
          <p className="mt-2 max-w-[60ch] text-[15px] text-night-text-2">{ui.paperTitle}</p>
          <div className="mt-8 max-w-[64ch] border-t border-night-rule pt-4">
            <p className="text-[14px] text-night-text-2">{ui.zenodo.cite}</p>
            <p className="mt-2 text-[15px] leading-normal">
              Agueh, Adetayo. &ldquo;{ZENODO.title}.&rdquo; Zenodo, 25 Oct. 2026,{" "}
              <a href={ZENODO.doiUrl} target="_blank" rel="noopener noreferrer" className="link break-all">doi:{ZENODO.doi}</a>.
            </p>
            <p className="mt-2 text-[14px] text-night-text-2">{ui.zenodo.license}</p>
          </div>
          <p className="mt-6 max-w-[60ch] text-[14px] leading-normal text-night-text-2">
            {ui.footerData} {ui.footerCode}
          </p>
        </div>
        <div className="flex flex-col items-start gap-4 md:items-end">
          <LanguageSwitch locale={locale} label={ui.langLabel} tone="night" />
          <a href={ZENODO.record} target="_blank" rel="noopener noreferrer" className="link text-[15px] text-night-text">{ui.zenodo.record}</a>
          <a href="#top" className="link text-[15px] text-night-text">{ui.backToTop}</a>
        </div>
      </div>
    </footer>
  );
}
