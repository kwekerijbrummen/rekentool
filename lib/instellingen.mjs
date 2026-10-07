// Centrale tarieven en btw-percentages in Netlify Blobs.
//   store: rekentool   sleutel: instellingen
//   inhoud: { rates: {sleutel: getal}, btwRates: {sleutel: getal}, gewijzigd: ISO-datum }
//
// Ieder verzoek controleert eerst zelf de toegang (zelfde cookie als de site).
//   GET  → { instellingen: {rates, btwRates} | null }
//          null = nog niets centraal opgeslagen; de rekentool gebruikt dan
//          zijn eigen DEFAULT_RATES / DEFAULT_BTW.
//   PUT  {rates, btwRates} → { instellingen: {rates, btwRates} }
//          pas succes nadat de write is teruggelezen en overeenkomt.

import { cookieGeldig, leesCookie, nu } from './toegang-kern.mjs';

export const STORE = 'rekentool';
export const SLEUTEL = 'instellingen';

const NAAM = /^[a-z0-9_]{1,40}$/;
const MAX_REGELS = 50;

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' }
  });
}

// Geeft een opgeschoonde kopie terug, of null bij ongeldige invoer.
function getallen(obj, max) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const sleutels = Object.keys(obj);
  if (sleutels.length === 0 || sleutels.length > MAX_REGELS) return null;
  const uit = {};
  for (const k of sleutels) {
    const v = obj[k];
    if (!NAAM.test(k) || typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
    uit[k] = v;
  }
  return uit;
}

export function valideer(body) {
  if (!body || typeof body !== 'object') return null;
  const rates = getallen(body.rates, 1e6);
  const btwRates = getallen(body.btwRates, 100);
  return rates && btwRates ? { rates: rates, btwRates: btwRates } : null;
}

function alleenWaarden(data) {
  return data && data.rates && data.btwRates ? { rates: data.rates, btwRates: data.btwRates } : null;
}

export async function verwerk(req, omgeving) {
  const cookie = leesCookie(req.headers.get('cookie'));
  if (!(await cookieGeldig(omgeving.wachtwoord || '', cookie, nu()))) return json(401, { fout: 'Geen toegang.' });

  if (req.method === 'GET') {
    try {
      const data = await omgeving.store.get(SLEUTEL, { type: 'json' });
      return json(200, { instellingen: alleenWaarden(data) });
    } catch (e) {
      return json(500, { fout: 'De centrale instellingen konden niet worden geladen.' });
    }
  }

  if (req.method === 'PUT') {
    const body = await req.json().catch(function () { return null; });
    const waarden = valideer(body);
    if (!waarden) return json(400, { fout: 'Ongeldige tarieven of btw-percentages.' });
    const opslag = { rates: waarden.rates, btwRates: waarden.btwRates, gewijzigd: new Date().toISOString() };
    try {
      await omgeving.store.setJSON(SLEUTEL, opslag);
      const terug = await omgeving.store.get(SLEUTEL, { type: 'json' });
      if (JSON.stringify(alleenWaarden(terug)) !== JSON.stringify(waarden)) throw new Error('Teruggelezen instellingen wijken af');
      return json(200, { instellingen: waarden });
    } catch (e) {
      return json(500, { fout: 'Opslaan is mislukt. Probeer het opnieuw.' });
    }
  }

  return new Response(null, { status: 405, headers: { Allow: 'GET, PUT' } });
}
