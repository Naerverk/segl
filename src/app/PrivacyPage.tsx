import { config } from '../config/app';
import { useI18n, type MessageKey } from '../i18n';
import { GitHubIcon, SupportLink } from './Shell';

function List({ keys }: { keys: MessageKey[] }) {
  const { t } = useI18n();
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
      {keys.map((k) => (
        <li key={k}>{t(k)}</li>
      ))}
    </ul>
  );
}

export function PrivacyPage() {
  const { t } = useI18n();
  return (
    <main id="main" className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('about.title')}</h1>
        <p className="mt-3 text-muted">{t('about.lead')}</p>
      </header>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('about.limits.title')}</h2>
        <List keys={['about.limits.1', 'about.limits.2', 'about.limits.3', 'about.limits.4', 'about.limits.5', 'about.limits.6', 'about.limits.7']} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('about.how.title')}</h2>
        <List keys={['about.how.1', 'about.how.2', 'about.how.3', 'about.how.4', 'about.how.5']} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('about.modes.title')}</h2>
        <List keys={['about.modes.all', 'about.modes.protect', 'about.modes.quality', 'about.modes.redact']} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('about.encryption.title')}</h2>
        <p>{t('about.encryption.body')}</p>
      </section>
      {config.sourceUrl && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('about.source.title')}</h2>
          <p>{t('about.source')}</p>
          <a
            href={config.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
            className="btn w-full justify-center no-underline sm:w-auto"
            data-testid="about-source-link"
          >
            <GitHubIcon className="h-4 w-4" />
            {t('about.source.link')}
            <span className="sr-only"> {t('footer.newTab')}</span>
          </a>
        </section>
      )}
      {config.buyMeACoffeeUrl && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">{t('about.support.title')}</h2>
          <p className="text-muted">{t('footer.supportText')}</p>
          <SupportLink />
        </section>
      )}
    </main>
  );
}
