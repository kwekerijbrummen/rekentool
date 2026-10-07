// Schermt de hele rekentool af met het gezamenlijke wachtwoord.
//   /inloggen  GET: inlogscherm; POST: wachtwoord controleren, cookie zetten
//   overige    zonder geldige cookie naar /inloggen (API en functies: 401)
// Het inlogscherm heeft zijn opmaak inline, zodat zonder toegang niets anders
// van de site bereikbaar hoeft te zijn.

import {
  cookieGeldig, leesCookie, maakCookieWaarde, nu, wachtwoordIngesteld, wachtwoordKlopt, zetCookie
} from '../../lib/toegang-kern.mjs';

function doorsturen(naar, cookie) {
  const headers = new Headers({ Location: naar, 'Cache-Control': 'private, no-store' });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers: headers });
}

function pagina(status, melding) {
  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Border Rekentool</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@500;600;700&family=Mulish:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  body{
    margin:0; min-height:100vh; background:#F5F2EA; color:#3D4F3A;
    font-family:'Mulish',ui-sans-serif,system-ui,sans-serif;
    display:flex; flex-direction:column; align-items:center; padding:32px 16px 60px;
  }
  .wrap{ width:100%; max-width:400px; }
  .header{ text-align:center; margin-bottom:20px; }
  .eyebrow{
    display:inline-block; padding:4px 12px; border-radius:999px; background:#E9E2D0; color:#8B6F47;
    font-size:12px; letter-spacing:.04em; font-weight:600; margin-bottom:12px;
  }
  h1{ font-family:'Quicksand',sans-serif; font-size:26px; font-weight:700; margin:0; }
  .card{
    background:#fff; border-radius:24px; padding:26px 24px; border:1px solid #EAE4D5;
    box-shadow:0 1px 3px rgba(61,79,58,.08), 0 8px 24px rgba(61,79,58,.06);
  }
  label{ display:block; font-family:'Quicksand',sans-serif; font-weight:700; font-size:14px; margin-bottom:6px; }
  input{
    width:100%; border:1px solid #DDD5C2; background:#FBF9F4; border-radius:14px;
    padding:10px 12px; font-size:16px; color:#3D4F3A; font-family:'Mulish',sans-serif;
  }
  input:focus-visible{ outline:2px solid #7C9473; outline-offset:1px; }
  button{
    width:100%; margin-top:16px; padding:13px; border-radius:14px; border:none; background:#7C9473;
    color:#fff; font-family:'Quicksand',sans-serif; font-weight:700; font-size:14px; cursor:pointer;
  }
  .melding{ margin:14px 0 0; font-size:14px; color:#B23A3A; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="eyebrow">BORDER CALCULATOR</div>
    <h1>Inloggen</h1>
  </div>
  <form class="card" method="post" action="/inloggen">
    <label for="wachtwoord">Wachtwoord</label>
    <input id="wachtwoord" name="wachtwoord" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus>
    <button type="submit">Inloggen</button>
${melding ? '    <p class="melding">' + melding + '</p>\n' : ''}  </form>
</div>
</body>
</html>
`;
  return new Response(html, {
    status: status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' }
  });
}

export default async function toegang(request, context) {
  const wachtwoord = Netlify.env.get('REKENTOOL_WACHTWOORD') || '';
  const pad = new URL(request.url).pathname;
  const geldig = await cookieGeldig(wachtwoord, leesCookie(request.headers.get('cookie')), nu());

  if (pad === '/inloggen') {
    if (request.method === 'POST') {
      if (!wachtwoordIngesteld(wachtwoord)) return pagina(503, 'Toegang is nog niet ingesteld.');
      const formulier = await request.formData().catch(function () { return null; });
      const invoer = formulier ? formulier.get('wachtwoord') : null;
      if (await wachtwoordKlopt(wachtwoord, typeof invoer === 'string' ? invoer : '')) {
        return doorsturen('/', zetCookie(await maakCookieWaarde(wachtwoord, nu())));
      }
      return pagina(401, 'Wachtwoord is niet juist.');
    }
    return geldig ? doorsturen('/') : pagina(200, '');
  }

  if (geldig) return context.next();
  if (pad.startsWith('/api/') || pad.startsWith('/.netlify/')) {
    return new Response(JSON.stringify({ fout: 'Geen toegang.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' }
    });
  }
  return doorsturen('/inloggen');
}

export const config = {
  path: '/*'
};
