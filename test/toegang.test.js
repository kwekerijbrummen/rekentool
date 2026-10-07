'use strict';

// Toegang: inlogscherm, cookie en afscherming van site en API (edge function),
// plus de eigen toegangscontrole van de functie `instellingen`.
// Testwachtwoord is fictief; het echte wachtwoord staat alleen in Netlify.
//   npm test

const test = require('node:test');
const assert = require('node:assert/strict');

const WW = 'test-wachtwoord-niet-echt-4K';
const BASIS = 'https://rekentool.test';

globalThis.Netlify = { env: { get: function (n) { return process.env[n]; } } };

let edge, kern, inst;
test.before(async function () {
  edge = (await import('../netlify/edge-functions/toegang.js')).default;
  kern = await import('../lib/toegang-kern.mjs');
  inst = await import('../lib/instellingen.mjs');
});
test.beforeEach(function () { process.env.REKENTOOL_WACHTWOORD = WW; });
test.after(function () { delete process.env.REKENTOOL_WACHTWOORD; });

function browser() {
  const pot = {};
  const cookieHeader = function () { return Object.keys(pot).map(function (k) { return k + '=' + pot[k]; }).join('; '); };
  async function vraag(methode, pad, formulier) {
    const init = { method: methode, headers: { cookie: cookieHeader() } };
    if (formulier) init.body = new URLSearchParams(formulier);
    let doorgegeven = false;
    const r = await edge(new Request(BASIS + pad, init), {
      next: function () { doorgegeven = true; return new Response('APP ' + pad, { status: 200 }); }
    });
    const sc = r.headers.get('set-cookie');
    if (sc) {
      const nw = sc.split(';')[0];
      pot[nw.slice(0, nw.indexOf('='))] = nw.slice(nw.indexOf('=') + 1);
    }
    return { r: r, doorgegeven: doorgegeven, tekst: await r.text(), pot: pot };
  }
  return { vraag: vraag, pot: pot };
}

test('zonder cookie: site en elk pad naar het inlogscherm, API 401', async function () {
  const b = browser();
  for (const pad of ['/', '/index.html', '/iets/anders.js']) {
    const a = await b.vraag('GET', pad);
    assert.equal(a.r.status, 303, pad);
    assert.equal(a.r.headers.get('location'), '/inloggen');
    assert.equal(a.doorgegeven, false);
  }
  for (const pad of ['/api/instellingen', '/.netlify/functions/instellingen']) {
    for (const m of ['GET', 'PUT']) {
      const a = await b.vraag(m, pad);
      assert.equal(a.r.status, 401, m + ' ' + pad);
      assert.equal(a.doorgegeven, false);
    }
  }
  const login = await b.vraag('GET', '/inloggen');
  assert.equal(login.r.status, 200);
  assert.match(login.tekst, /type="password"/);
  assert.doesNotMatch(login.tekst, new RegExp(WW));
});

test('verkeerd wachtwoord: geen cookie, geen toegang', async function () {
  const b = browser();
  const a = await b.vraag('POST', '/inloggen', { wachtwoord: 'fout' });
  assert.equal(a.r.status, 401);
  assert.match(a.tekst, /niet juist/);
  assert.equal(Object.keys(b.pot).length, 0);
  assert.equal((await b.vraag('GET', '/')).doorgegeven, false);
});

test('juist wachtwoord: beveiligde cookie, daarna blijvend toegang', async function () {
  const b = browser();
  const a = await b.vraag('POST', '/inloggen', { wachtwoord: WW });
  assert.equal(a.r.status, 303);
  assert.equal(a.r.headers.get('location'), '/');
  const sc = a.r.headers.get('set-cookie');
  assert.match(sc, /^__Host-rekentool_toegang=v1\./);
  for (const vlag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert.ok(sc.includes(vlag), vlag);
  assert.ok(!sc.includes(WW), 'wachtwoord niet in cookie');
  for (let i = 0; i < 3; i++) assert.equal((await b.vraag('GET', '/')).doorgegeven, true);
  assert.equal((await b.vraag('GET', '/api/instellingen')).doorgegeven, true);
  // ingelogd op /inloggen → terug naar de rekentool
  assert.equal((await b.vraag('GET', '/inloggen')).r.headers.get('location'), '/');
  // nieuw venster zonder cookie → opnieuw inloggen
  assert.equal((await browser().vraag('GET', '/')).r.headers.get('location'), '/inloggen');
});

test('vervalste, verlopen of oude cookie geeft geen toegang', async function () {
  const n = kern.nu();
  const geldig = await kern.maakCookieWaarde(WW, n);
  assert.equal(await kern.cookieGeldig(WW, geldig, n), true);
  assert.equal(await kern.cookieGeldig('ander-wachtwoord', geldig, n), false);
  assert.equal(await kern.cookieGeldig(WW, geldig, n + kern.GELDIGHEID_SECONDEN + 1), false);
  const [v, t, h] = geldig.split('.');
  assert.equal(await kern.cookieGeldig(WW, v + '.' + (Number(t) + 999) + '.' + h, n), false);
  assert.equal(await kern.cookieGeldig(WW, 'v1.9999999999.' + 'A'.repeat(43), n), false);
});

test('zonder ingesteld wachtwoord: niemand komt binnen', async function () {
  delete process.env.REKENTOOL_WACHTWOORD;
  const b = browser();
  assert.equal((await b.vraag('POST', '/inloggen', { wachtwoord: '' })).r.status, 503);
  assert.equal((await b.vraag('GET', '/')).doorgegeven, false);
});

test('functie instellingen controleert zelf de cookie', async function () {
  const store = { get: async function () { throw new Error('mag niet gelezen worden'); }, setJSON: async function () { throw new Error('mag niet'); } };
  for (const cookie of ['', kern.COOKIE + '=v1.9999999999.' + 'A'.repeat(43)]) {
    for (const m of ['GET', 'PUT']) {
      const r = await inst.verwerk(new Request(BASIS + '/api/instellingen', {
        method: m, headers: { cookie: cookie, 'content-type': 'application/json' },
        body: m === 'PUT' ? JSON.stringify({ rates: { km: 1 }, btwRates: { km: 0 } }) : undefined
      }), { store: store, wachtwoord: WW });
      assert.equal(r.status, 401, m);
    }
  }
});
