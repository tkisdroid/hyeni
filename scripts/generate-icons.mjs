import sharp from "sharp";
import { mkdirSync, readFileSync } from "fs";
import { join } from "path";

const sourceLogoPath = "src/assets/new_logo.png";
const androidRes = "android/app/src/main/res";

const iconSizes = [
  { name: "mipmap-mdpi", size: 48 },
  { name: "mipmap-hdpi", size: 72 },
  { name: "mipmap-xhdpi", size: 96 },
  { name: "mipmap-xxhdpi", size: 144 },
  { name: "mipmap-xxxhdpi", size: 192 },
];

const foregroundSizes = [
  { name: "mipmap-mdpi", size: 108 },
  { name: "mipmap-hdpi", size: 162 },
  { name: "mipmap-xhdpi", size: 216 },
  { name: "mipmap-xxhdpi", size: 324 },
  { name: "mipmap-xxxhdpi", size: 432 },
];

const splashFiles = [
  "drawable/splash.png",
  "drawable-land-mdpi/splash.png",
  "drawable-land-hdpi/splash.png",
  "drawable-land-xhdpi/splash.png",
  "drawable-land-xxhdpi/splash.png",
  "drawable-land-xxxhdpi/splash.png",
  "drawable-port-mdpi/splash.png",
  "drawable-port-hdpi/splash.png",
  "drawable-port-xhdpi/splash.png",
  "drawable-port-xxhdpi/splash.png",
  "drawable-port-xxxhdpi/splash.png",
];

let trimmedLogo;

function iconBackgroundSvg(size) {
  const radius = Math.round(size * 0.24);
  return Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF9FC"/>
      <stop offset="1" stop-color="#FFE6F0"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#bg)"/>
</svg>`);
}

function circleMaskSvg(size) {
  return Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/>
</svg>`);
}

function transparentSvg(size) {
  return Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="none"/>
</svg>`);
}

function splashBackgroundSvg(width, height) {
  return Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFF8FB"/>
      <stop offset="1" stop-color="#FFEEF6"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
</svg>`);
}

async function getTrimmedLogo() {
  if (trimmedLogo) {
    return trimmedLogo;
  }

  const { data, info } = await sharp(readFileSync(sourceLogoPath))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      const distanceFromWhite = Math.max(255 - red, 255 - green, 255 - blue);

      let nextAlpha = alpha;
      if (distanceFromWhite <= 6) {
        nextAlpha = 0;
      } else if (distanceFromWhite < 22) {
        nextAlpha = Math.round(((distanceFromWhite - 6) / 16) * alpha);
      }

      data[offset + 3] = nextAlpha;
      if (nextAlpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    trimmedLogo = sharp(data, { raw: info }).png().toBuffer();
    return trimmedLogo;
  }

  const padding = 18;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const width = Math.min(info.width - left, maxX - minX + 1 + padding * 2);
  const height = Math.min(info.height - top, maxY - minY + 1 + padding * 2);

  trimmedLogo = sharp(data, { raw: info })
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return trimmedLogo;
}

async function resizedLogo(maxWidth, maxHeight) {
  return sharp(await getTrimmedLogo())
    .resize({
      width: Math.floor(maxWidth),
      height: Math.floor(maxHeight),
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
}

async function measureVisibleContent(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const alpha = data[offset + 3];
      if (alpha > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return {
      centerX: info.width / 2,
      centerY: info.height / 2,
    };
  }

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

async function compositeWithShadow(base, logoBuffer, width, height, options) {
  const metadata = await sharp(logoBuffer).metadata();
  const visible = await measureVisibleContent(logoBuffer);
  const left = Math.round(width / 2 - visible.centerX);
  const top = Math.round(height * options.centerY - visible.centerY);
  const alpha = await sharp(logoBuffer)
    .extractChannel("alpha")
    .blur(options.blur)
    .linear(options.opacity)
    .toBuffer();
  const shadow = await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 3,
      background: { r: 80, g: 42, b: 56 },
    },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();

  return sharp(base)
    .composite([
      {
        input: shadow,
        left,
        top: top + options.offset,
      },
      {
        input: logoBuffer,
        left,
        top,
      },
    ])
    .png()
    .toBuffer();
}

async function makeIcon(size) {
  const logo = await resizedLogo(size * 0.94, size * 0.94);
  return compositeWithShadow(iconBackgroundSvg(size), logo, size, size, {
    blur: Math.max(1, Math.round(size / 48)),
    centerY: 0.5,
    offset: Math.max(1, Math.round(size / 42)),
    opacity: 0.14,
  });
}

async function makeRoundIcon(iconBuffer, size) {
  return sharp(iconBuffer)
    .composite([{ input: circleMaskSvg(size), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function makeForeground(size) {
  const logo = await resizedLogo(size * 0.84, size * 0.84);
  return compositeWithShadow(transparentSvg(size), logo, size, size, {
    blur: Math.max(1, Math.round(size / 42)),
    centerY: 0.5,
    offset: Math.max(1, Math.round(size / 48)),
    opacity: 0.12,
  });
}

async function makeSplash(width, height) {
  const logo = await resizedLogo(Math.min(width, height) * 0.58, Math.min(width, height) * 0.58);
  return compositeWithShadow(splashBackgroundSvg(width, height), logo, width, height, {
    blur: Math.max(3, Math.round(Math.min(width, height) / 52)),
    centerY: 0.5,
    offset: Math.max(2, Math.round(Math.min(width, height) / 64)),
    opacity: 0.13,
  });
}

async function generate() {
  for (const { name, size } of iconSizes) {
    const dir = join(androidRes, name);
    mkdirSync(dir, { recursive: true });

    const icon = await makeIcon(size);
    await sharp(icon).toFile(join(dir, "ic_launcher.png"));
    await sharp(await makeRoundIcon(icon, size)).toFile(join(dir, "ic_launcher_round.png"));
    console.log(`${name}: ${size}x${size}`);
  }

  for (const { name, size } of foregroundSizes) {
    const dir = join(androidRes, name);
    mkdirSync(dir, { recursive: true });

    await sharp(await makeForeground(size)).toFile(join(dir, "ic_launcher_foreground.png"));
  }

  await sharp(await makeIcon(192)).toFile("public/icon-192.png");
  await sharp(await makeIcon(512)).toFile("public/icon-512.png");

  for (const splashPath of splashFiles) {
    const path = join(androidRes, splashPath);
    const { width, height } = await sharp(path).metadata();
    await sharp(await makeSplash(width, height)).toFile(path);
  }

  console.log("All icons and splash assets generated from src/assets/new_logo.png");
}

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
