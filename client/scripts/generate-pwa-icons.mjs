// Génère les icônes PWA (Android / iOS / PC) À PARTIR DU LOGO DE L'ÉCOLE.
//
//   npm run pwa:icons                       # utilise src/assets/logo.png
//   SCHOOL_LOGO_FILE=/chemin/logo.png npm run pwa:icons
//   npm run pwa:icons -- /chemin/logo.png
//
// Le logo est redimensionné en carré avec fond blanc (fond transparent conservé
// autour du logo). La version « maskable » garde 20 % de marge de sécurité pour
// les icônes découpées par Android. Relancez `npm run build` après génération.
import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.SCHOOL_LOGO_FILE || process.argv[2] || path.join(racine, 'src', 'assets', 'logo.png');
const dossier = path.join(racine, 'public', 'pwa');

if (!fs.existsSync(source)) {
  console.error(`Logo introuvable : ${source}`);
  process.exit(1);
}
fs.mkdirSync(dossier, { recursive: true });

async function generer(taille, nom, { maskable = false } = {}) {
  const marge = maskable ? Math.round(taille * 0.2) : Math.round(taille * 0.06);
  const contenu = await sharp(source)
    .resize(taille - 2 * marge, taille - 2 * marge, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  const fond = {
    create: {
      width: taille,
      height: taille,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  };
  await sharp(fond)
    .composite([{ input: contenu, gravity: 'center' }])
    .png()
    .toFile(path.join(dossier, nom));
  console.log(`  ✓ ${nom} (${taille}×${taille})`);
}

await generer(192, 'icon-192.png');
await generer(512, 'icon-512.png');
await generer(512, 'maskable-512.png', { maskable: true });
await generer(180, 'apple-touch-icon.png');
await generer(32, 'favicon-32.png');
console.log(`Icônes PWA générées depuis ${source}`);
