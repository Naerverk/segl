import { useState } from 'react';
import { useI18n } from '../../i18n';
import type { PasswordRequest } from '../../hooks/useDocumentController';
import { Dialog } from '../Dialog';

export function PasswordDialog({ request }: { request: PasswordRequest | null }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const submit = (pw: string | null) => {
    setValue('');
    request?.resolve(pw);
  };
  return (
    <Dialog open={!!request} title={t('password.title')} onCancel={() => submit(null)} labelledBy="pw-title">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <p className="mb-4 text-sm text-muted">{t('password.lead')}</p>
        <label htmlFor="pdf-password" className="field-label">
          {t('password.label')}
        </label>
        <input
          id="pdf-password"
          type="password"
          autoComplete="off"
          autoFocus
          className="input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={request?.reason === 'incorrect'}
          aria-describedby={request?.reason === 'incorrect' ? 'pw-error' : undefined}
        />
        {request?.reason === 'incorrect' && (
          <p id="pw-error" role="alert" className="mt-2 text-sm text-danger">
            {t('password.incorrect')}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn" onClick={() => submit(null)}>
            {t('password.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!value}>
            {t('password.open')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
