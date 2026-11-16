import { Check, Copy, KeyRound, Link2, Loader2, RefreshCw } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useI18n } from '../../i18n';
import { isWeakPassword } from '../../lib/random';
import { createOneTimeLink, DEFAULT_LINK_LIFETIME, LINK_LIFETIMES, type LinkLifetime } from '../../share/oneTimeLink';

/** Copies text to the clipboard and briefly confirms. Clipboard errors are ignored silently. */
export function CopyButton({ text, label, testId }: { text: string; label: string; testId?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable: the text is still visible and selectable */
    }
  };
  return (
    <button type="button" className="btn shrink-0" onClick={() => void copy()} data-testid={testId} aria-live="polite">
      {copied ? <Check className="h-4 w-4 text-ok" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? t('protect.copied') : label}
    </button>
  );
}

/** "Protect with a password" toggle and the (generated, editable) password. */
export function PasswordField({
  enabled,
  password,
  onToggle,
  onChange,
  onRegenerate,
}: {
  enabled: boolean;
  password: string;
  onToggle: (on: boolean) => void;
  onChange: (pw: string) => void;
  onRegenerate: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const empty = enabled && !password.trim();
  const weak = enabled && !empty && isWeakPassword(password);
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} data-testid="protect-toggle" />
        <KeyRound className="h-4 w-4 text-muted" aria-hidden />
        {t('protect.toggle')}
      </label>
      {enabled && (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-pw`} className="field-label">
            {t('protect.label')}
          </label>
          <div className="flex gap-1.5">
            <input
              id={`${id}-pw`}
              className="input min-w-0 font-mono"
              value={password}
              onChange={(e) => onChange(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-testid="protect-password"
            />
            <button type="button" className="btn-icon shrink-0" onClick={onRegenerate} title={t('protect.new')} aria-label={t('protect.new')} data-testid="protect-new">
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {empty ? (
            <p className="text-xs text-warn">{t('protect.empty')}</p>
          ) : weak ? (
            <p className="text-xs text-warn" data-testid="protect-weak">
              {t('protect.weak')}
            </p>
          ) : (
            <p className="text-xs text-muted">{t('protect.hint')}</p>
          )}
        </div>
      )}
    </div>
  );
}

type LinkState = { status: 'idle' } | { status: 'creating' } | { status: 'done'; link: string; lifetime: LinkLifetime } | { status: 'error' };

/**
 * Creates a one-time link for the password on the configured Yopass server. Nothing is sent
 * until the user clicks the button; only the encrypted password is sent, never the document.
 * Remount (key) when the password changes.
 */
export function OneTimeLinkPanel({ password, serverUrl }: { password: string; serverUrl: string }) {
  const { t } = useI18n();
  const id = useId();
  const host = new URL(serverUrl).host;
  const [lifetime, setLifetime] = useState<LinkLifetime>(DEFAULT_LINK_LIFETIME);
  const [state, setState] = useState<LinkState>({ status: 'idle' });

  const create = async () => {
    setState({ status: 'creating' });
    try {
      const link = await createOneTimeLink({ serverUrl, secret: password, lifetimeSeconds: lifetime });
      setState({ status: 'done', link, lifetime });
    } catch {
      setState({ status: 'error' });
    }
  };

  return (
    <section aria-labelledby={`${id}-t`} className="space-y-2 rounded-md border border-line p-3" data-testid="share-panel">
      <h3 id={`${id}-t`} className="flex items-center gap-1.5 text-sm font-semibold">
        <Link2 className="h-4 w-4 text-muted" aria-hidden />
        {t('share.title')}
      </h3>
      {state.status === 'done' ? (
        <div className="space-y-1.5">
          <label htmlFor={`${id}-link`} className="field-label">
            {t('share.link')}
          </label>
          <div className="flex gap-1.5">
            <input id={`${id}-link`} className="input min-w-0 font-mono text-xs" value={state.link} readOnly onFocus={(e) => e.target.select()} data-testid="share-link" />
            <CopyButton text={state.link} label={t('protect.copy')} testId="share-copy" />
          </div>
          <p className="text-xs text-muted">{t('share.readyHint', { lifetime: t(`share.lifetime.${state.lifetime}`) })}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted">{t('share.explain', { host })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-life`} className="text-xs text-muted">
              {t('share.lifetime')}
            </label>
            <select
              id={`${id}-life`}
              className="input w-auto py-1 text-xs"
              value={lifetime}
              onChange={(e) => setLifetime(Number(e.target.value) as LinkLifetime)}
              disabled={state.status === 'creating'}
              data-testid="share-lifetime"
            >
              {LINK_LIFETIMES.map((s) => (
                <option key={s} value={s}>
                  {t(`share.lifetime.${s}`)}
                </option>
              ))}
            </select>
            <button type="button" className="btn ml-auto" onClick={() => void create()} disabled={state.status === 'creating'} data-testid="share-create">
              {state.status === 'creating' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
              {state.status === 'creating' ? t('share.creating') : t('share.create')}
            </button>
          </div>
          {state.status === 'error' && (
            <p className="note-danger text-xs" role="alert" data-testid="share-error">
              {t('share.error', { host })}{' '}
              <a href={serverUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="underline">
                {t('share.openManually', { host })}
              </a>
            </p>
          )}
        </>
      )}
    </section>
  );
}
