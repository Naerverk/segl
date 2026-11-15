import { Coffee, ShieldCheck } from 'lucide-react';
import { config } from '../config/app';
import { LANGUAGES, useI18n, type Language } from '../i18n';

/** Wordmark: "segl." */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`text-xl font-extrabold tracking-[-0.07em] ${className}`}>
      segl<span className="text-accent">.</span>
    </span>
  );
}

export function Header({
  view,
  onNavigate,
}: {
  view: 'app' | 'about';
  onNavigate: (v: 'app' | 'about') => void;
}) {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-line bg-surface px-4 py-2 md:static">
      <a href="#/" onClick={() => onNavigate('app')} className="text-fg no-underline" aria-label={t('app.name')}>
        <Wordmark />
      </a>
      <nav className="ml-auto flex items-center gap-1.5" aria-label={t('nav.menu')}>
        <a
          href={view === 'about' ? '#/' : '#/personvern'}
          className="btn-ghost"
          aria-current={view === 'about' ? 'page' : undefined}
          data-testid="nav-about"
        >
          {view === 'about' ? t('nav.back') : t('nav.about')}
        </a>
        <label className="sr-only" htmlFor="lang-select">
          {t('nav.language')}
        </label>
        <select
          id="lang-select"
          className="cursor-pointer rounded-md bg-transparent px-1.5 py-1 text-sm text-muted hover:bg-sunken hover:text-fg"
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
          data-testid="lang-select"
        >
          {(Object.keys(LANGUAGES) as Language[]).map((l) => (
            <option key={l} value={l}>
              {l === 'nb' ? 'Norsk' : 'English'}
            </option>
          ))}
        </select>
      </nav>
    </header>
  );
}

export function SupportLink({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  if (!config.buyMeACoffeeUrl) return null;
  return (
    <a
      href={config.buyMeACoffeeUrl}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={`inline-flex items-center gap-1.5 text-muted underline-offset-2 hover:text-fg hover:underline ${className}`}
      data-testid="support-link"
    >
      <Coffee className="h-3.5 w-3.5" aria-hidden />
      {t('footer.support')}
      <span className="sr-only"> {t('footer.newTab')}</span>
    </a>
  );
}

/**
 * The official Buy Me a Coffee button, isolated in a sandboxed iframe (opaque origin: no access
 * to segl.'s page, documents, storage or cookies). See src/config/bmc.ts for the frame's own CSP
 * and the Subresource Integrity check. Only rendered after an export, and only if configured.
 */
export function BuyMeACoffeeFrame({ className = '' }: { className?: string }) {
  if (!config.buyMeACoffeeUrl || !/^https:\/\/(www\.)?buymeacoffee\.com\/[A-Za-z0-9_-]+\/?$/.test(config.buyMeACoffeeUrl)) return null;
  return (
    <iframe
      src={`${import.meta.env.BASE_URL}bmc/`}
      title="Buy me a coffee"
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      loading="lazy"
      className={`block h-16 w-full border-0 ${className}`}
      data-testid="bmc-frame"
    />
  );
}

/** GitHub mark (Lucide no longer ships brand icons). */
export function GitHubIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function SourceLink({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  if (!config.sourceUrl) return null;
  return (
    <a
      href={config.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      className={`inline-flex items-center gap-1.5 text-muted underline-offset-2 hover:text-fg hover:underline ${className}`}
      data-testid="source-link"
    >
      <GitHubIcon className="h-3.5 w-3.5" />
      {t('footer.license')}
      <span className="sr-only"> {t('footer.newTab')}</span>
    </a>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    // Phones: everything stacked and centred. From sm: notice | GitHub (centre) | support.
    <footer className="flex flex-col items-center gap-1.5 border-t border-line px-4 py-3 text-center text-xs text-muted sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-x-5 sm:py-1.5 sm:text-left">
      <span className="sm:inline-flex sm:items-center sm:gap-1.5 sm:justify-self-start" data-testid="local-notice">
        <ShieldCheck className="mr-1 inline h-3.5 w-3.5 shrink-0 align-[-2px] text-ok sm:mr-0" aria-hidden />
        {t('footer.local')}
      </span>
      <SourceLink className="sm:justify-self-center" />
      <SupportLink className="sm:justify-self-end" />
    </footer>
  );
}
