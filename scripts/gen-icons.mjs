import sharp from 'sharp';

// CashUp logo: green gradient bg, white $ sign, gold arrow, glass bars, CASHUP badge
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#22c55e"/>
      <stop offset="50%" stop-color="#16a34a"/>
      <stop offset="100%" stop-color="#15803d"/>
    </linearGradient>
    <linearGradient id="bgInner" x1="30%" y1="0%" x2="70%" y2="100%">
      <stop offset="0%" stop-color="#4ade80" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#15803d" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="arrowGrad" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="60%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#fde68a"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.15"/>
    </linearGradient>
    <linearGradient id="swirl" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#4ade80" stop-opacity="0"/>
      <stop offset="40%" stop-color="#4ade80" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#4ade80" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="arrowGlow">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="6" stdDeviation="14" flood-color="#000" flood-opacity="0.3"/>
    </filter>
    <clipPath id="rounded">
      <rect width="512" height="512" rx="115"/>
    </clipPath>
  </defs>

  <g clip-path="url(#rounded)">
    <!-- Green background -->
    <rect width="512" height="512" fill="url(#bg)"/>
    <rect width="512" height="512" fill="url(#bgInner)"/>

    <!-- Swirl/glow effect behind $ -->
    <ellipse cx="256" cy="230" rx="180" ry="80" fill="url(#swirl)" opacity="0.5" transform="rotate(-30 256 230)"/>
    <ellipse cx="256" cy="230" rx="160" ry="60" fill="url(#swirl)" opacity="0.4" transform="rotate(20 256 230)"/>

    <!-- Glass bar charts — bottom right -->
    <rect x="288" y="310" width="38" height="110" rx="7" fill="url(#barGrad)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <rect x="340" y="270" width="38" height="150" rx="7" fill="url(#barGrad)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <rect x="392" y="240" width="38" height="180" rx="7" fill="url(#barGrad)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <!-- Bar top highlights -->
    <rect x="290" y="312" width="34" height="10" rx="5" fill="rgba(255,255,255,0.4)"/>
    <rect x="342" y="272" width="34" height="10" rx="5" fill="rgba(255,255,255,0.4)"/>
    <rect x="394" y="242" width="34" height="10" rx="5" fill="rgba(255,255,255,0.4)"/>

    <!-- Gold arrow (diagonal up-right) -->
    <g filter="url(#arrowGlow)">
      <path d="M 155 360 L 370 130" stroke="url(#arrowGrad)" stroke-width="28" stroke-linecap="round"/>
      <!-- Arrowhead -->
      <polygon points="370,130 310,148 352,192" fill="url(#arrowGrad)"/>
    </g>

    <!-- Dollar sign — large white with shadow -->
    <text x="218" y="298"
      font-family="Arial Black, Helvetica, sans-serif"
      font-size="240"
      font-weight="900"
      fill="white"
      filter="url(#shadow)"
      opacity="0.95">$</text>

    <!-- Bottom white pill badge with CASHUP -->
    <rect x="96" y="418" width="320" height="64" rx="32" fill="white" opacity="0.95"/>
    <text x="256" y="462"
      font-family="Arial Black, Helvetica, sans-serif"
      font-size="42"
      font-weight="900"
      fill="#15803d"
      text-anchor="middle"
      letter-spacing="3">CASHUP</text>
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
