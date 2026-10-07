// Gedeelde toegangscontrole voor de edge function (Deno) en de functie
// `instellingen` (Node). Alleen Web Crypto, geen afhankelijkheden.
// Zelfde aanpak als de voorraadapp HT/LS.
//
// Het echte wachtwoord staat uitsluitend in de server-side omgevingsvariabele
// REKENTOOL_WACHTWOORD. De cookie bevat alleen een vervaldatum en een
// HMAC-handtekening met een sleutel die van het wachtwoord is afgeleid; het
// wachtwoord zelf staat er niet in. Een ander wachtwoord maakt alle bestaande
// cookies ongeldig.

export const COOKIE = '__Host-rekentool_toegang';
export const GELDIGHEID_SECONDEN = 180 * 24 * 60 * 60;

const tekst = new TextEncoder();

function base64url(buffer) {
  let s = '';
  for (const b of new Uint8Array(buffer)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Vergelijking in constante tijd.
function gelijk(a, b) {
  if (a.length !== b.length) return false;
  let verschil = 0;
  for (let i = 0; i < a.length; i++) verschil |= a[i] ^ b[i];
  return verschil === 0;
}

async function sha256(s) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', tekst.encode(s)));
}

async function handtekening(wachtwoord, inhoud) {
  const ruw = await sha256('borderrekentool toegang v1\n' + wachtwoord);
  const sleutel = await crypto.subtle.importKey('raw', ruw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(await crypto.subtle.sign('HMAC', sleutel, tekst.encode(inhoud)));
}

export function wachtwoordIngesteld(wachtwoord) {
  return typeof wachtwoord === 'string' && wachtwoord.length > 0;
}

export async function wachtwoordKlopt(wachtwoord, invoer) {
  if (!wachtwoordIngesteld(wachtwoord) || typeof invoer !== 'string') return false;
  return gelijk(await sha256(wachtwoord), await sha256(invoer));
}

export async function maakCookieWaarde(wachtwoord, nuSeconden) {
  const inhoud = 'v1.' + (nuSeconden + GELDIGHEID_SECONDEN);
  return inhoud + '.' + await handtekening(wachtwoord, inhoud);
}

export async function cookieGeldig(wachtwoord, waarde, nuSeconden) {
  if (!wachtwoordIngesteld(wachtwoord) || typeof waarde !== 'string') return false;
  const m = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/.exec(waarde);
  if (!m || Number(m[1]) <= nuSeconden) return false;
  const verwacht = await handtekening(wachtwoord, 'v1.' + m[1]);
  return gelijk(tekst.encode(verwacht), tekst.encode(m[2]));
}

export function leesCookie(header) {
  for (const deel of String(header || '').split(';')) {
    const i = deel.indexOf('=');
    if (i > 0 && deel.slice(0, i).trim() === COOKIE) return deel.slice(i + 1).trim();
  }
  return null;
}

export function zetCookie(waarde) {
  return COOKIE + '=' + waarde + '; Path=/; Max-Age=' + GELDIGHEID_SECONDEN + '; HttpOnly; Secure; SameSite=Lax';
}

export function nu() {
  return Math.floor(Date.now() / 1000);
}
