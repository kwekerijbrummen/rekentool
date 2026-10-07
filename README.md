# Border Rekentool

Interne rekentool, gehost op Netlify (project `borderrekentool`, branch `main`).

- **Toegang:** de hele site staat achter één gezamenlijk wachtwoord
  (edge function `netlify/edge-functions/toegang.js`, ondertekende cookie
  `__Host-rekentool_toegang`, 180 dagen geldig). Het wachtwoord staat alleen in
  de Netlify environment variable **`REKENTOOL_WACHTWOORD`**. Een ander
  wachtwoord instellen maakt alle bestaande logins ongeldig.
- **Centrale tarieven:** tarieven en btw-percentages staan in Netlify Blobs,
  store `rekentool`, sleutel `instellingen`, via de functie
  `/api/instellingen` (GET/PUT, alleen met geldige login). Zolang er niets is
  opgeslagen gelden `DEFAULT_RATES` / `DEFAULT_BTW` uit `public/index.html`.
- **Zoekmachines:** sitebreed `X-Robots-Tag: noindex, nofollow` (`netlify.toml`).

Tests: `npm install && npm test`
