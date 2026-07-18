/**
 * Branded HTML/text templates for the auth sign-in email, sent via Resend
 * instead of Firebase's unbrandable built-in passwordless email
 * (docs/plans/ideas/branded-auth-email-delivery.md). Hand-written table-based
 * HTML with inline styles — no react-email/JSX, no external CSS/JS/images, so
 * it survives Gmail/Outlook/Apple Mail's markup stripping.
 *
 * Copy is deliberately generic: the server can't know whether this address is
 * registering or returning until the link is redeemed.
 */

export interface AuthEmailContent {
  actionUrl: string;
}

/** Caller builds the actual subject as `${prefix} · ${timestamp}` so repeated
 * sends don't collapse into one Gmail thread. */
export const AUTH_EMAIL_SUBJECT_PREFIX = 'Accede a Cultuvilla';

const FOOTER_TEXT = 'Cultuvilla · cultuvilla.app@gmail.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAuthEmailHtml(content: AuthEmailContent): string {
  const url = escapeHtml(content.actionUrl);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${AUTH_EMAIL_SUBJECT_PREFIX}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f1ec; font-family:Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ec; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:12px; overflow:hidden;">
            <tr>
              <td style="background-color:#2f5233; padding:24px; text-align:center;">
                <!-- TODO: replace with a real hosted logo URL under acceso.cultuvilla.es once one exists; styled text avoids hotlinking a non-existent asset. -->
                <span style="color:#ffffff; font-size:24px; font-weight:bold; letter-spacing:0.5px;">Cultuvilla</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 24px; color:#2b2b2b; font-size:16px; line-height:24px;">
                <p style="margin:0 0 16px;">Pulsa el botón para entrar en Cultuvilla.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                  <tr>
                    <td align="center" style="border-radius:8px; background-color:#2f5233;">
                      <a href="${url}" target="_blank" style="display:inline-block; padding:14px 28px; color:#ffffff; text-decoration:none; font-size:16px; font-weight:bold; border-radius:8px;">Entrar en Cultuvilla</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px; font-size:14px; color:#5a5a5a;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:0 0 24px; font-size:13px; word-break:break-all;"><a href="${url}" target="_blank" style="color:#2f5233;">${url}</a></p>
                <p style="margin:0; font-size:13px; color:#5a5a5a;">Si no has solicitado este correo, puedes ignorarlo con tranquilidad.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px; background-color:#f4f1ec; text-align:center; font-size:12px; color:#8a8a8a;">
                ${escapeHtml(FOOTER_TEXT)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderAuthEmailText(content: AuthEmailContent): string {
  return [
    'Cultuvilla',
    '',
    'Pulsa este enlace para entrar en Cultuvilla:',
    content.actionUrl,
    '',
    'Si no has solicitado este correo, puedes ignorarlo con tranquilidad.',
    '',
    FOOTER_TEXT,
  ].join('\n');
}
