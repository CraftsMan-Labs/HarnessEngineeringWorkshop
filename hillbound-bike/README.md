# Hillbound Bike

Deterministic 2D hill-riding game from the Hillbound Bike benchmark specification. Everything runs locally: no backend, accounts, or network after install.

## Requirements

- Node.js 22 or 24
- npm

## Commands

```bash
npm ci
npm run dev -- --host 0.0.0.0
```

```bash
npm run lint
npm run test
npm run build
npm run preview
npm run test:e2e
npm run test:all
```

Playwright needs a local Chromium once:

```bash
npx playwright install chromium
```

## Play

Open the dev or preview URL. Choose **Green Hills** or **Moon Run**.

- Throttle: Arrow Right, D, or W
- Brake / reverse: Arrow Left, A, or S
- Pause: Escape or P

Touch pedals appear on the play screen.
