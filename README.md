# POLYPHARM

A psychiatric drug-drug interaction card game, built as a needs-assessment
project for a psychiatry clerkship at Carle Illinois College of Medicine
(CIMED). Players collect drug cards and treat patient cases while avoiding
interactions, contraindications, and outdated prescribing habits.

**[Play it here](https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/)**
*(update this link once GitHub Pages is live)*

---

## What this is

Psychiatric medications interact with each other constantly, and most of
that knowledge is taught informally, one resident or APP explaining it to
another. This game turns the interaction rules into a type-matchup system,
similar to a Pokémon-style card game: every drug has a clearance route
(how it leaves the body) and a pharmacodynamic type (what it does at
receptors), and those two axes determine what happens when drugs are
combined.

Players work through seven "wards," each introducing a new drug class and
a new interaction concept, collecting cards and treating patient cases
along the way.

## How it was built

The game was designed and built by Tony (CIMED) in collaboration with
Claude, an AI assistant made by Anthropic, which wrote the React
implementation and interaction engine. Every patient case was checked
against current published clinical guidelines rather than relying on the
model's training data alone. Full build notes and a numbered reference
list are available in-app under **About** on the title screen.

## Running it locally

```bash
npm install
npm run dev
```

You'll also need `SHRIMP1.opus` and `SHRIMP2.opus` in the `public/`
folder for the background music to play; they are not included in this
repository.

## Deploying

This repo is set up to deploy automatically to GitHub Pages via GitHub
Actions on every push to `main`. See `.github/workflows/deploy.yml`.
Update the `base` path in `vite.config.js` to match your repository name
before your first deploy.

## Disclaimer

This is a study aid for medical trainees, not a clinical decision support
tool. The interaction model is deliberately simplified so it can be
learned and remembered. It omits dose, route, timing, individual
pharmacogenomics, and much else that matters at the bedside. Never use it
to make a prescribing decision — check a real reference and consult a
pharmacist.

React + Vite
This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.
Currently, two official plugins are available:
@vitejs/plugin-react uses Oxc
@vitejs/plugin-react-swc uses SWC
React Compiler
The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see this documentation.
Expanding the Oxlint configuration
If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the TS template for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## License

MIT. See `LICENSE`.
