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

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="grid grid-cols-1 items-center gap-x-5 gap-y-1 border-t border-line px-4 py-1.5 text-xs text-muted sm:grid-cols-[1fr_auto_1fr]">
      <span className="flex items-center gap-1.5" data-testid="local-notice">
        <ShieldCheck className="h-3.5 w-3.5 text-ok" aria-hidden />
        {t('footer.local')}
      </span>
      {config.sourceUrl && (
        <a href={config.sourceUrl} target="_blank" rel="noopener noreferrer" className="justify-self-center underline-offset-2 hover:text-fg hover:underline" referrerPolicy="no-referrer">
          {t('footer.license')}
          <span className="sr-only"> {t('footer.newTab')}</span>
        </a>
      )}
      <SupportLink className="justify-self-end" />
    </footer>
  );
}
