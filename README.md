# Volejbal — dohadovanie termínov

Jednoduchá statická appka na dohadovanie tréningov / zápasov. Frontend je čisté HTML/CSS/JS, backend je Supabase (Postgres + Realtime).

## Funkcie

- Vytvorenie termínu (dátum, čas, miesto, poznámka) — bez limitu prihlásených.
- Prihlásenie/odhlásenie po mene (uložené v localStorage).
- Voliteľná preferencia „aj 2v2" — hráč povie, že si zahrá aj menšiu hru.
- **Automatický výpočet kurtov**: appka podľa počtu hráčov a preferencií 2v2 odporučí koľko kurtov rezervovať (klasika = 6–8 hráčov/kurt, 2v2 = 4 hráči/kurt) a maximalizuje počet hrajúcich.
- Realtime — zmeny sa prejavia okamžite u všetkých.

## Štruktúra

```
scheduler/
├── index.html      HTML kostra
├── styles.css      štýly
├── config.js       Supabase URL + kľúč (uprav pre svoju inštanciu)
├── app.js          logika (load, create, join, leave, delete, realtime)
├── setup.sql       SQL na vytvorenie tabuliek + RLS
└── README.md
```

## Setup

1. **Supabase projekt**
   - Vytvor projekt na [supabase.com](https://supabase.com/) (free tier stačí).
   - V dashboarde: **SQL Editor → New query → vlož obsah `setup.sql` → Run**.
     - Skript je idempotentný — pokojne ho spusti aj keď už máš staré tabuľky (pridá stĺpec `willing_2v2` do `signups` a odstráni `capacity` z `events`).
   - **Settings → API** → skopíruj:
     - `Project URL` → do `config.js` ako `SUPABASE_URL`
     - `anon` alebo `publishable` kľúč → do `config.js` ako `SUPABASE_ANON_KEY`

2. **Lokálne spustenie**
   Kvôli `type="module"` a CORS to nefunguje cez `file://`. Spusti akýkoľvek statický server, napr.:
   ```
   npx serve .
   ```
   alebo Python:
   ```
   python -m http.server 8000
   ```
   a otvor `http://localhost:8000`.

## Deploy zadarmo

Appka je čisto statická — hostiteľ nepotrebuje Node/PHP, iba serve súborov.

### GitHub Pages (najjednoduchšie)

1. Vytvor repo na GitHube, pushni tam tieto súbory:
   ```
   git init
   git add .
   git commit -m "initial"
   git branch -M main
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
2. V repe: **Settings → Pages → Build and deployment**
   - Source: **Deploy from a branch**
   - Branch: **main** / folder: **/ (root)** → Save
3. O ~1 minútu bude appka na `https://<user>.github.io/<repo>/`.

### Netlify (drag & drop, ešte rýchlejšie)

1. Otvor [app.netlify.com/drop](https://app.netlify.com/drop)
2. Pretiahni celý priečinok `scheduler/` do okna.
3. Dostaneš URL typu `https://random-name.netlify.app`.

### Vercel

1. Nainštaluj CLI: `npm i -g vercel`
2. V priečinku: `vercel` → prihlás sa → potvrď defaulty. Hotovo.

### Cloudflare Pages

1. Prihlás sa na [pages.cloudflare.com](https://pages.cloudflare.com/), pripoj GitHub repo.
2. Build command: (prázdne), output directory: `/`.

## Bezpečnosť kľúča

`SUPABASE_ANON_KEY` (aj nový `sb_publishable_*`) je verejný **za predpokladu**, že máš zapnuté RLS (Row Level Security) a rozumné policy. `setup.sql` zapína RLS a nastavuje otvorené policy — čokoľvek s odkazom na appku vie čítať aj zapisovať. Pre súkromnú partiu, kde kľúč nikomu nedáš, to stačí. Pre verejný projekt pridaj napr. auth alebo prísnejšie policy.

## Ako otestovať, či všetko funguje

1. Otvor stránku → zadaj svoje meno → OK.
2. Klikni **+ Nový termín** → dátum, miesto → Vytvoriť.
3. Ak sa niečo pokazí, otvor DevTools (F12) → záložka **Console** — chyby zo Supabase sa tam logujú (`load() zlyhal:`, `createEvent() zlyhal:` atď.) aj s message/hint/details, aby si vedel presne, čo Supabase odmietol.
