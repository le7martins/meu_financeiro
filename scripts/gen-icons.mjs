import sharp from 'sharp';

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 520">
  <defs>
    <!-- Background green gradient -->
    <radialGradient id="bg" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#5dd45a"/>
      <stop offset="45%" stop-color="#2db82a"/>
      <stop offset="100%" stop-color="#1a7a18"/>
    </radialGradient>
    <!-- Dollar sign chrome gradient -->
    <linearGradient id="dollarGrad" x1="10%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="30%" stop-color="#e8e8e8"/>
      <stop offset="55%" stop-color="#c0c0c0"/>
      <stop offset="75%" stop-color="#e8e8e8"/>
      <stop offset="100%" stop-color="#a0a0a0"/>
    </linearGradient>
    <!-- Dollar sign edge/stroke -->
    <linearGradient id="dollarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#888888"/>
      <stop offset="100%" stop-color="#555555"/>
    </linearGradient>
    <!-- Arrow gradient gold -->
    <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#c97b00"/>
      <stop offset="40%" stop-color="#f5a800"/>
      <stop offset="70%" stop-color="#ffd040"/>
      <stop offset="100%" stop-color="#ffe680"/>
    </linearGradient>
    <!-- Arrow shadow -->
    <linearGradient id="arrowShadow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#a06000" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#a06000" stop-opacity="0"/>
    </linearGradient>
    <!-- Bar glass gradient -->
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="10%" y2="100%">
      <stop offset="0%" stop-color="#90ff90" stop-opacity="0.9"/>
      <stop offset="25%" stop-color="#50dd50" stop-opacity="0.7"/>
      <stop offset="60%" stop-color="#20aa20" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#107010" stop-opacity="0.5"/>
    </linearGradient>
    <!-- Bar left highlight -->
    <linearGradient id="barHL" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <!-- Neon glow for bars -->
    <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- Dollar shadow -->
    <filter id="dollarShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="4" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
    <!-- Arrow glow -->
    <filter id="arrowGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <!-- Swirl glow -->
    <filter id="swirlGlow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="roundedClip">
      <rect width="512" height="520" rx="110"/>
    </clipPath>
  </defs>

  <g clip-path="url(#roundedClip)">
    <!-- Background -->
    <rect width="512" height="520" fill="url(#bg)"/>

    <!-- Subtle radial light in center -->
    <radialGradient id="centerLight" cx="45%" cy="42%" r="45%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <rect width="512" height="520" fill="url(#centerLight)"/>

    <!-- Green swirl orbit line (behind bars) -->
    <g filter="url(#swirlGlow)">
      <path d="M 30 390 Q 130 460 256 420 Q 380 380 480 300" fill="none" stroke="#7fff7f" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
      <path d="M 50 370 Q 160 450 280 400 Q 400 355 490 265" fill="none" stroke="#afffaf" stroke-width="2.5" stroke-linecap="round" opacity="0.35"/>
    </g>

    <!-- Bar chart columns (5 bars, increasing height, glass effect) -->
    <!-- Bar 1 - shortest -->
    <g filter="url(#neonGlow)">
      <rect x="68" y="368" width="36" height="62" rx="5" fill="url(#barGrad)" stroke="#4dff4d" stroke-width="1.2" opacity="0.9"/>
      <rect x="70" y="370" width="10" height="58" rx="3" fill="url(#barHL)"/>
    </g>
    <!-- Bar 2 -->
    <g filter="url(#neonGlow)">
      <rect x="118" y="338" width="36" height="92" rx="5" fill="url(#barGrad)" stroke="#4dff4d" stroke-width="1.2" opacity="0.9"/>
      <rect x="120" y="340" width="10" height="88" rx="3" fill="url(#barHL)"/>
    </g>
    <!-- Bar 3 (behind dollar, partial) -->
    <g filter="url(#neonGlow)">
      <rect x="168" y="300" width="36" height="130" rx="5" fill="url(#barGrad)" stroke="#4dff4d" stroke-width="1.2" opacity="0.85"/>
      <rect x="170" y="302" width="10" height="126" rx="3" fill="url(#barHL)"/>
    </g>
    <!-- Bar 4 -->
    <g filter="url(#neonGlow)">
      <rect x="330" y="262" width="40" height="168" rx="5" fill="url(#barGrad)" stroke="#4dff4d" stroke-width="1.2" opacity="0.85"/>
      <rect x="332" y="264" width="12" height="164" rx="3" fill="url(#barHL)"/>
    </g>
    <!-- Bar 5 - tallest -->
    <g filter="url(#neonGlow)">
      <rect x="386" y="228" width="44" height="202" rx="5" fill="url(#barGrad)" stroke="#4dff4d" stroke-width="1.2" opacity="0.85"/>
      <rect x="388" y="230" width="13" height="198" rx="3" fill="url(#barHL)"/>
    </g>

    <!-- Arrow shadow/depth -->
    <path d="M 188 388 L 390 118" stroke="#7a4a00" stroke-width="22" stroke-linecap="round" opacity="0.3"/>

    <!-- Gold arrow body -->
    <g filter="url(#arrowGlow)">
      <path d="M 195 382 L 378 148" stroke="url(#arrowGrad)" stroke-width="18" stroke-linecap="round"/>
      <!-- Arrowhead -->
      <polygon points="395,108 330,155 372,198" fill="url(#arrowGrad)"/>
      <!-- Arrowhead highlight -->
      <polygon points="395,108 340,148 365,150" fill="#ffe88a" opacity="0.7"/>
    </g>

    <!-- Dollar sign - large, metallic, with 3D effect -->
    <g filter="url(#dollarShadow)">
      <!-- Back layer for depth -->
      <text x="152" y="320"
        font-family="Arial Black, Impact, sans-serif"
        font-size="252"
        font-weight="900"
        fill="#888888"
        opacity="0.4"
        transform="translate(5,7)">$</text>
      <!-- Main dollar - chrome gradient -->
      <text x="152" y="320"
        font-family="Arial Black, Impact, sans-serif"
        font-size="252"
        font-weight="900"
        fill="url(#dollarGrad)"
        stroke="url(#dollarStroke)"
        stroke-width="3">$</text>
      <!-- Top highlight streak -->
      <text x="152" y="320"
        font-family="Arial Black, Impact, sans-serif"
        font-size="252"
        font-weight="900"
        fill="none"
        stroke="white"
        stroke-width="1.5"
        opacity="0.5">$</text>
    </g>

    <!-- White pill badge at bottom -->
    <rect x="56" y="428" width="400" height="72" rx="36" fill="white" opacity="0.95"/>
    <!-- Badge subtle shadow top -->
    <rect x="56" y="428" width="400" height="8" rx="4" fill="rgba(0,0,0,0.06)"/>
    <!-- CASHUP text -->
    <text x="256" y="479"
      font-family="Arial Black, Helvetica Neue, sans-serif"
      font-size="48"
      font-weight="900"
      fill="#1a6e18"
      text-anchor="middle"
      letter-spacing="4">CASHUP</text>
  </g>
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
