// Centrale tarieven en btw-percentages (Netlify Blobs, regio eu-central-1).
// Logica en toegangscontrole: lib/instellingen.mjs.

import { getStore } from '@netlify/blobs';
import { STORE, verwerk } from '../../lib/instellingen.mjs';

export default async function instellingen(req) {
  return verwerk(req, {
    // Pas aangemaakt na de toegangscontrole in verwerk().
    get store() { return getStore({ name: STORE, region: 'eu-central-1', consistency: 'strong' }); },
    wachtwoord: process.env.REKENTOOL_WACHTWOORD
  });
}

export const config = {
  path: '/api/instellingen'
};
