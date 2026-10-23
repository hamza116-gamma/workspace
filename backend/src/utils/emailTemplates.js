// "Quiet Luxury" email templates, matching the app: deep green brand band
// with a mint mark, a white card on the canvas tone, ink-first type and a
// brand button. Emails need table layout + inline styles (no external CSS),
// so every style lives on the element. Light-only on purpose: many clients
// recolour dark-mode emails unpredictably.

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });

// Design tokens (frontend/src/styles/tokens.css, light theme).
const C = {
  canvas: '#f4f6f3',
  surface: '#ffffff',
  well: '#f1f4f0',
  ink: '#0f2119',
  ink2: '#5b6b62',
  ink3: '#93a098',
  line: '#e6ebe6',
  brand: '#173d32',
  brandDeep: '#12332a',
  brandInk: '#0f2e25',
  brandSoft: '#e7f2ed',
  mint: '#d8f3dc',
  warn: '#c07708',
  warnSoft: '#fdf2df',
};

const FONT =
  "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const initialOf = (name) =>
  escapeHtml(
    String(name || 'W')
      .trim()
      .charAt(0)
      .toUpperCase() || 'W',
  );

// Rounded "bulletproof" button: works in Gmail, Apple Mail and Outlook (VML).
const button = (label, url) => `
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="24%" stroke="f" fillcolor="${C.brand}">
<w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${label}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-- -->
<a href="${url}" style="display:inline-block;background:${C.brand};color:#ffffff;text-decoration:none;font-family:${FONT};font-size:15px;font-weight:600;letter-spacing:-0.01em;line-height:48px;height:48px;padding:0 28px;border-radius:12px;box-shadow:0 6px 16px -8px rgba(23,61,50,0.7);">${label}&nbsp;&nbsp;&rarr;</a>
<!--<![endif]-->`;

// Small pill, e.g. "Expires in 1 hour".
const pill = (text, tone = 'brand') => {
  const [bg, fg] = tone === 'warn' ? [C.warnSoft, C.warn] : [C.brandSoft, C.brandInk];
  return `<span style="display:inline-block;background:${bg};color:${fg};font-family:${FONT};font-size:12px;font-weight:600;line-height:24px;padding:0 10px;border-radius:999px;">&#9679;&nbsp; ${text}</span>`;
};

const renderLayout = ({
  preheader,
  eyebrow,
  title,
  bodyHtml,
  highlightHtml = '',
  ctaLabel,
  ctaUrl,
  pillHtml = '',
  footer,
}) => `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>
  @media (max-width: 600px) {
    .ql-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .ql-title { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.canvas};font-family:${FONT};color:${C.ink};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.canvas};">
    <tr>
      <td align="center" style="padding:40px 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Brand band -->
          <tr>
            <td bgcolor="${C.brand}" style="background:${C.brand};background-image:radial-gradient(240px 140px at 50% 0%, rgba(216,243,220,0.20), rgba(216,243,220,0) 70%),linear-gradient(180deg, ${C.brand} 0%, ${C.brandDeep} 100%);border-radius:22px 22px 0 0;padding:26px 36px;" class="ql-pad">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="width:38px;height:38px;border-radius:12px;background:${C.mint};color:${C.brandInk};font-family:${FONT};font-size:17px;font-weight:700;line-height:38px;text-align:center;letter-spacing:-0.04em;">C</div>
                  </td>
                  <td style="vertical-align:middle;padding-left:12px;font-family:${FONT};font-size:17px;font-weight:650;letter-spacing:-0.02em;color:#ffffff;">Circle Chat</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:${C.surface};border:1px solid ${C.line};border-top:0;border-radius:0 0 22px 22px;padding:36px 36px 32px;" class="ql-pad">
              <div style="font-family:${FONT};font-size:11px;font-weight:650;letter-spacing:0.1em;text-transform:uppercase;color:${C.ink3};">${escapeHtml(eyebrow)}</div>
              <h1 class="ql-title" style="margin:8px 0 0;font-family:${FONT};font-size:27px;line-height:1.2;font-weight:700;letter-spacing:-0.03em;color:${C.ink};">${escapeHtml(title)}</h1>
              <div style="margin-top:14px;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.ink2};">${bodyHtml}</div>
              ${highlightHtml}
              <div style="margin-top:28px;">${button(ctaLabel, ctaUrl)}</div>
              ${pillHtml ? `<div style="margin-top:16px;">${pillHtml}</div>` : ''}

              <!-- Fallback link -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td style="background:${C.well};border-radius:12px;padding:14px 16px;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.ink3};">
                    Button not working? Paste this link into your browser:<br />
                    <a href="${ctaUrl}" style="color:${C.brand};font-weight:500;word-break:break-all;text-decoration:none;">${ctaUrl}</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top:24px;height:1px;background:${C.line};font-size:0;line-height:0;">&nbsp;</div>
              <p style="margin:18px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.ink3};">${footer}</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.ink3};">
              Sent by Circle Chat &middot; your team's home for conversation<br />
              &copy; ${new Date().getFullYear()} Circle Chat
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// "You're joining" card: workspace initial tile + name + who invited you.
const workspaceCard = (organizationName, inviterName) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border:1px solid ${C.line};border-radius:16px;">
  <tr>
    <td style="padding:16px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle;">
            <div style="width:44px;height:44px;border-radius:13px;background:${C.brandSoft};color:${C.brandInk};font-family:${FONT};font-size:18px;font-weight:700;line-height:44px;text-align:center;">${initialOf(organizationName)}</div>
          </td>
          <td style="vertical-align:middle;padding-left:14px;font-family:${FONT};">
            <div style="font-size:15.5px;font-weight:650;letter-spacing:-0.015em;color:${C.ink};">${escapeHtml(organizationName)}</div>
            <div style="margin-top:2px;font-size:12.5px;color:${C.ink3};">${
              inviterName ? `Invited by ${escapeHtml(inviterName)}` : 'Workspace invitation'
            }</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

const invitationEmail = ({ organizationName, inviteLink, inviterName }) => {
  const org = escapeHtml(organizationName);
  const inviter = inviterName ? escapeHtml(inviterName) : null;
  const intro = inviter
    ? `<strong style="color:${C.ink};font-weight:600;">${inviter}</strong> has invited you to join <strong style="color:${C.ink};font-weight:600;">${org}</strong> on Circle Chat &mdash; channels, direct messages and huddles for your team, all in one place.`
    : `You've been invited to join <strong style="color:${C.ink};font-weight:600;">${org}</strong> on Circle Chat &mdash; channels, direct messages and huddles for your team, all in one place.`;

  return {
    subject: `${inviterName ? `${inviterName} invited you` : "You're invited"} to join ${organizationName} on Circle Chat`,
    text: `${inviterName ? `${inviterName} has invited you` : "You've been invited"} to join ${organizationName} on Circle Chat.\n\nAccept the invitation: ${inviteLink}\n\nThis invitation expires in 7 days. If you weren't expecting it, you can safely ignore this email.`,
    html: renderLayout({
      preheader: `Join ${organizationName} on Circle Chat — the invitation expires in 7 days.`,
      eyebrow: 'Invitation',
      title: `Join ${organizationName}`,
      bodyHtml: `<p style="margin:0;">${intro}</p>`,
      highlightHtml: workspaceCard(organizationName, inviterName),
      ctaLabel: 'Accept invitation',
      ctaUrl: inviteLink,
      pillHtml: pill('Expires in 7 days'),
      footer:
        "If you weren't expecting this invitation, you can safely ignore this email. No account is created until you accept.",
    }),
  };
};

const passwordResetEmail = ({ resetLink }) => ({
  subject: 'Reset your Circle Chat password',
  text: `We received a request to reset your Circle Chat password.\n\nChoose a new password: ${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email - your password won't change.`,
  html: renderLayout({
    preheader: 'Use this link to choose a new password. It expires in 1 hour.',
    eyebrow: 'Account security',
    title: 'Reset your password',
    bodyHtml:
      '<p style="margin:0;">We received a request to reset the password for your Circle Chat account. Choose a new one with the button below.</p>',
    ctaLabel: 'Choose a new password',
    ctaUrl: resetLink,
    pillHtml: pill('Expires in 1 hour', 'warn'),
    footer:
      "Didn't ask for this? You can safely ignore this email &mdash; your password won't change, and nobody can use this link without access to your inbox.",
  }),
});

module.exports = { invitationEmail, passwordResetEmail, escapeHtml };
