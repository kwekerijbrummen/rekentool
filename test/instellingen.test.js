'use strict';

// Centrale instellingen (functie `instellingen`) met een nagebootste Blob-store.
//   npm test

const test = require('node:test');
const assert = require('node:assert/strict');

const WW = 'test-wachtwoord-niet-echt-4K';
const URL_API = 'https://rekentool.test/api/instellingen';

let inst, kern;
test.before(async function () {
  inst = await import('../lib/instellingen.mjs');
  kern = await import('../lib/toegang-kern.mjs');
});

function nepStore() {
  const data = {};
  return {
    data: data,
    get: async function (k) { return k in data ? JSON.parse(data[k]) : null; },
    setJSON: async function (k, v) { data[k] = JSON.stringify(v); return { modified: true }; }
  };
}

async function cookie() { return kern.COOKIE + '=' + await kern.maakCookieWaarde(WW, kern.nu()); }

async function vraag(store, methode, body) {
  const r = await inst.verwerk(new Request(URL_API, {
    method: methode,
    headers: { cookie: await cookie(), 'content-type': 'application/json' },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  }), { store: store, wachtwoord: WW });
  return { status: r.status, body: r.status === 405 ? null : await r.json(), headers: r.headers };
}

const NIEUW = {
  rates: { ontwerp_start: 25, ontwerp_m2: 5, uitzetten_start: 20, uitzetten_m2: 1, beplanting: 30, inplanten: 2, km: 0.5 },
  btwRates: { ontwerp_start: 21, ontwerp_m2: 0, uitzetten_start: 0, uitzetten_m2: 0, beplanting: 9, inplanten: 0, km: 0 }
};

test('nog niets opgeslagen: null (rekentool valt terug op DEFAULT_RATES/DEFAULT_BTW)', async function () {
  const a = await vraag(nepStore(), 'GET');
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, { instellingen: null });
  assert.equal(a.headers.get('cache-control'), 'private, no-store');
});

test('opslaan en daarna (ander apparaat) dezelfde waarden lezen', async function () {
  const store = nepStore();
  const p = await vraag(store, 'PUT', NIEUW);
  assert.equal(p.status, 200);
  assert.deepEqual(p.body.instellingen, NIEUW);
  const opgeslagen = JSON.parse(store.data[inst.SLEUTEL]);
  assert.deepEqual(opgeslagen.rates, NIEUW.rates);
  assert.ok(opgeslagen.gewijzigd);
  assert.equal(inst.STORE, 'rekentool');
  assert.equal(inst.SLEUTEL, 'instellingen');
  assert.deepEqual((await vraag(store, 'GET')).body.instellingen, NIEUW);
});

test('ongeldige invoer wordt geweigerd en niet opgeslagen', async function () {
  const store = nepStore();
  const fout = [
    'geen json', {}, { rates: NIEUW.rates }, { rates: [], btwRates: NIEUW.btwRates },
    { rates: { km: -1 }, btwRates: { km: 0 } }, { rates: { km: '1' }, btwRates: { km: 0 } },
    { rates: { km: 1 }, btwRates: { km: 101 } }, { rates: { 'KM<x>': 1 }, btwRates: { km: 0 } }
  ];
  for (const body of fout) assert.equal((await vraag(store, 'PUT', body)).status, 400, JSON.stringify(body));
  assert.deepEqual(store.data, {});
});

test('mislukte write of afwijkende teruglezing: geen succes', async function () {
  const kapot = nepStore();
  kapot.setJSON = async function () { throw new Error('blobs onbereikbaar'); };
  let a = await vraag(kapot, 'PUT', NIEUW);
  assert.equal(a.status, 500);
  assert.match(a.body.fout, /mislukt/);

  const stil = nepStore();
  stil.setJSON = async function () { return { modified: true }; }; // schrijft niets
  a = await vraag(stil, 'PUT', NIEUW);
  assert.equal(a.status, 500);
});

test('andere methoden niet toegestaan', async function () {
  assert.equal((await vraag(nepStore(), 'DELETE')).status, 405);
});
