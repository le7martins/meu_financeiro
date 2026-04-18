import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';

// SVG icon: dark bg + green gradient coin with upward arrow
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#0d2a1a"/>
      <stop offset="100%" stop-color="#080c12"/>
    </radialGradient>
    <linearGradient id="coinGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#16a34a"/>
    </linearGradient>
    <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4ade80"/>
      <stop offset="100%" stop-color="#86efac"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#4ade80" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>

  <!-- Subtle grid lines -->
  <line x1="0" y1="340" x2="512" y2="340" stroke="#4ade8008" stroke-width="1"/>
  <line x1="0" y1="400" x2="512" y2="400" stroke="#4ade8008" stroke-width="1"/>
  <line x1="170" y1="0" x2="170" y2="512" stroke="#4ade8008" stroke-width="1"/>
  <line x1="340" y1="0" x2="340" y2="512" stroke="#4ade8008" stroke-width="1"/>

  <!-- Glow circle behind coin -->
  <circle cx="256" cy="230" r="130" fill="#4ade80" opacity="0.06"/>

  <!-- Coin circle -->
  <circle cx="256" cy="230" r="110" fill="url(#coinGrad)" filter="url(#shadow)"/>
  <circle cx="256" cy="230" r="96" fill="none" stroke="#86efac" stroke-width="3" opacity="0.4"/>

  <!-- R$ symbol -->
  <text x="256" y="272"
    font-family="'Georgia', serif"
    font-size="108"
    font-weight="bold"
    fill="#080c12"
    text-anchor="middle"
    opacity="0.92">R$</text>

  <!-- Upward trend line at bottom -->
  <polyline
    points="72,410 152,380 232,395 312,348 392,315 440,290"
    fill="none"
    stroke="url(#arrowGrad)"
    stroke-width="8"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
    opacity="0.9"/>

  <!-- Dots on trend -->
  <circle cx="152" cy="380" r="6" fill="#4ade80" opacity="0.8"/>
  <circle cx="312" cy="348" r="6" fill="#4ade80" opacity="0.8"/>
  <circle cx="440" cy="290" r="8" fill="#86efac"/>
</svg>
`;

async function generate(size, outPath) {
  const buf = Buffer.from(svg(size));
  await sharp(buf, { density: 300 })
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`Generated ${outPath}`);
}

await generate(192, 'public/icon-192.png');
await generate(512, 'public/icon-512.png');
console.log('Done!');
