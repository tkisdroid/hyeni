import sharp from "sharp";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

// Cute bunny icon SVG (pink bunny on gradient background)
const bunnyForegroundSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Ears -->
  <ellipse cx="175" cy="115" rx="42" ry="88" fill="#FFD6E8"/>
  <ellipse cx="337" cy="115" rx="42" ry="88" fill="#FFD6E8"/>
  <ellipse cx="175" cy="115" rx="26" ry="65" fill="#FFB3D1"/>
  <ellipse cx="337" cy="115" rx="26" ry="65" fill="#FFB3D1"/>

  <!-- Body -->
  <ellipse cx="256" cy="340" rx="130" ry="112" fill="#FFF0F7"/>

  <!-- Head -->
  <circle cx="256" cy="252" r="120" fill="#FFF0F7"/>

  <!-- Eyes - cute curved lines -->
  <path d="M200 232 Q210 218 220 232" stroke="#FF7BAC" stroke-width="8" stroke-linecap="round" fill="none"/>
  <path d="M292 232 Q302 218 312 232" stroke="#FF7BAC" stroke-width="8" stroke-linecap="round" fill="none"/>

  <!-- Nose -->
  <ellipse cx="256" cy="265" rx="14" ry="10" fill="#FFB3D1"/>

  <!-- Mouth -->
  <path d="M235 280 Q256 300 277 280" stroke="#FF7BAC" stroke-width="6" stroke-linecap="round" fill="none"/>

  <!-- Cheeks -->
  <circle cx="190" cy="272" r="24" fill="#FFB3D1" opacity="0.5"/>
  <circle cx="322" cy="272" r="24" fill="#FFB3D1" opacity="0.5"/>

  <!-- Arms -->
  <ellipse cx="145" cy="350" rx="35" ry="50" fill="#FFF0F7" transform="rotate(-20 145 350)"/>
  <ellipse cx="367" cy="350" rx="35" ry="50" fill="#FFF0F7" transform="rotate(20 367 350)"/>

  <!-- Feet -->
  <ellipse cx="200" cy="430" rx="40" ry="22" fill="#FFD6E8"/>
  <ellipse cx="312" cy="430" rx="40" ry="22" fill="#FFD6E8"/>

  <!-- Star sparkle -->
  <text x="350" y="170" font-size="40" fill="#F9A8D4" opacity="0.8">✦</text>
  <text x="130" y="200" font-size="28" fill="#A78BFA" opacity="0.6">✦</text>
</svg>`;

const bunnyFullSVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFF0F7"/>
      <stop offset="50%" style="stop-color:#E8F4FD"/>
      <stop offset="100%" style="stop-color:#FFF8E7"/>
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="240" fill="white" opacity="0.3"/>

  <!-- Ears -->
  <ellipse cx="180" cy="105" rx="38" ry="80" fill="#FFD6E8"/>
  <ellipse cx="332" cy="105" rx="38" ry="80" fill="#FFD6E8"/>
  <ellipse cx="180" cy="105" rx="22" ry="58" fill="#FFB3D1"/>
  <ellipse cx="332" cy="105" rx="22" ry="58" fill="#FFB3D1"/>

  <!-- Body -->
  <ellipse cx="256" cy="330" rx="115" ry="100" fill="#FFF0F7"/>

  <!-- Head -->
  <circle cx="256" cy="245" r="108" fill="#FFF0F7"/>

  <!-- Eyes -->
  <path d="M205 228 Q214 215 223 228" stroke="#FF7BAC" stroke-width="7" stroke-linecap="round" fill="none"/>
  <path d="M289 228 Q298 215 307 228" stroke="#FF7BAC" stroke-width="7" stroke-linecap="round" fill="none"/>

  <!-- Nose -->
  <ellipse cx="256" cy="258" rx="12" ry="9" fill="#FFB3D1"/>

  <!-- Mouth -->
  <path d="M238 272 Q256 290 274 272" stroke="#FF7BAC" stroke-width="5" stroke-linecap="round" fill="none"/>

  <!-- Cheeks -->
  <circle cx="195" cy="265" r="20" fill="#FFB3D1" opacity="0.5"/>
  <circle cx="317" cy="265" r="20" fill="#FFB3D1" opacity="0.5"/>

  <!-- Arms -->
  <ellipse cx="152" cy="340" rx="30" ry="45" fill="#FFF0F7" transform="rotate(-20 152 340)"/>
  <ellipse cx="360" cy="340" rx="30" ry="45" fill="#FFF0F7" transform="rotate(20 360 340)"/>

  <!-- Feet -->
  <ellipse cx="205" cy="415" rx="35" ry="18" fill="#FFD6E8"/>
  <ellipse cx="307" cy="415" rx="35" ry="18" fill="#FFD6E8"/>

  <!-- Star sparkles -->
  <text x="345" y="160" font-size="32" fill="#F9A8D4" opacity="0.8">✦</text>
  <text x="140" y="185" font-size="22" fill="#A78BFA" opacity="0.6">✦</text>
</svg>`;

// Android mipmap sizes
const sizes = [
  { name: "mipmap-mdpi", size: 48 },
  { name: "mipmap-hdpi", size: 72 },
  { name: "mipmap-xhdpi", size: 96 },
  { name: "mipmap-xxhdpi", size: 144 },
  { name: "mipmap-xxxhdpi", size: 192 },
];

// Adaptive icon foreground sizes (108dp * density)
const fgSizes = [
  { name: "mipmap-mdpi", size: 108 },
  { name: "mipmap-hdpi", size: 162 },
  { name: "mipmap-xhdpi", size: 216 },
  { name: "mipmap-xxhdpi", size: 324 },
  { name: "mipmap-xxxhdpi", size: 432 },
];

const androidRes = "android/app/src/main/res";

async function generate() {
  // Generate regular launcher icons (ic_launcher.png)
  for (const { name, size } of sizes) {
    const dir = join(androidRes, name);
    mkdirSync(dir, { recursive: true });

    await sharp(Buffer.from(bunnyFullSVG))
      .resize(size, size)
      .png()
      .toFile(join(dir, "ic_launcher.png"));

    // Round icon
    const roundMask = Buffer.from(`
      <svg width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
      </svg>`);

    await sharp(Buffer.from(bunnyFullSVG))
      .resize(size, size)
      .composite([{ input: await sharp(roundMask).resize(size, size).png().toBuffer(), blend: "dest-in" }])
      .png()
      .toFile(join(dir, "ic_launcher_round.png"));

    console.log(`  ${name}: ${size}x${size}`);
  }

  // Generate adaptive icon foreground
  for (const { name, size } of fgSizes) {
    const dir = join(androidRes, name);
    mkdirSync(dir, { recursive: true });

    await sharp(Buffer.from(bunnyForegroundSVG))
      .resize(size, size)
      .png()
      .toFile(join(dir, "ic_launcher_foreground.png"));
  }

  // Generate web icon (for PWA)
  await sharp(Buffer.from(bunnyFullSVG))
    .resize(512, 512)
    .png()
    .toFile("public/icon-512.png");

  await sharp(Buffer.from(bunnyFullSVG))
    .resize(192, 192)
    .png()
    .toFile("public/icon-192.png");

  console.log("\nAll icons generated!");
}

generate().catch(console.error);
