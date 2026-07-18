import { describe, it, expect } from 'vitest';
import {
  renderAuthEmailHtml,
  renderAuthEmailText,
  AUTH_EMAIL_SUBJECT_PREFIX,
} from '../../auth/authEmailTemplate';

describe('authEmailTemplate', () => {
  const actionUrl = 'https://villa-events.web.app/finish?oobCode=abc123';

  it('subject prefix includes Cultuvilla', () => {
    expect(AUTH_EMAIL_SUBJECT_PREFIX).toContain('Cultuvilla');
  });

  it('html includes the action URL and Spanish security note', () => {
    const html = renderAuthEmailHtml({ actionUrl });
    expect(html).toContain(actionUrl);
    expect(html).toContain('Cultuvilla');
    expect(html).toMatch(/Entrar en Cultuvilla/);
    expect(html).toMatch(/si no has solicitado este correo/i);
  });

  it('text includes the action URL and Spanish security note', () => {
    const text = renderAuthEmailText({ actionUrl });
    expect(text).toContain(actionUrl);
    expect(text).toMatch(/si no has solicitado este correo/i);
  });

  it('escapes HTML-significant characters in the URL for the html renderer', () => {
    const maliciousUrl = 'https://evil.example/?x=<script>&y="quoted"';
    const html = renderAuthEmailHtml({ actionUrl: maliciousUrl });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;y=');
  });

  it('does not escape the raw text alternative (plain text has no HTML entities)', () => {
    const maliciousUrl = 'https://evil.example/?x=<script>&y="quoted"';
    const text = renderAuthEmailText({ actionUrl: maliciousUrl });
    expect(text).toContain(maliciousUrl);
  });
});
