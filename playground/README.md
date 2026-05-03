# Playground

Static, single-page AHAP authoring tool. Drop into Vercel/Netlify/GitHub Pages.

## Run locally

The playground imports the compiled plugin from `../dist/esm/`. Build the plugin first, then serve.

```bash
# from the plugin root:
npm install
npm run build

# serve the playground (any static server)
npx http-server playground -p 8080
# → open http://localhost:8080
```

## Deploy to Vercel

```bash
cd playground
npx vercel deploy --prod
```

The included `vercel.json` builds the parent plugin (`npm run build`) and rewrites `/dist/*` to the compiled artifacts. Or push the repo to a Vercel project pointing at this directory and it auto-detects the config.

## Deploy elsewhere

Any static host works. Copy the `playground/` folder plus the `dist/esm/` modules. Or vendor the bundle by changing imports in `playground.js` to `https://esm.sh/capacitor-rich-haptics@latest/...` (no build step needed).
