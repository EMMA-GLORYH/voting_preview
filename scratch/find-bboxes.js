const sharp = require('sharp');
const fs = require('fs');

async function findBBoxes() {
  const image = sharp('C:/Users/emman/.gemini/antigravity-ide/brain/474fe5a2-1447-41dc-96a2-937c5532150b/.user_uploaded/media_1791434696212.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Let's find columns where x is within [80, 250]
  // Photo 1: around y 180..420
  // Photo 2: around y 520..700
  // Let's compute minX, maxX, minY, maxY for each region
  let p1MinX = width, p1MaxX = 0, p1MinY = height, p1MaxY = 0;
  let p2MinX = width, p2MaxX = 0, p2MinY = height, p2MaxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 70; x < 260; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const isWhite = (r > 245 && g > 245 && b > 245);
      if (!isWhite) {
        if (y >= 180 && y <= 420) {
          p1MinX = Math.min(p1MinX, x);
          p1MaxX = Math.max(p1MaxX, x);
          p1MinY = Math.min(p1MinY, y);
          p1MaxY = Math.max(p1MaxY, y);
        } else if (y >= 520 && y <= 750) {
          p2MinX = Math.min(p2MinX, x);
          p2MaxX = Math.max(p2MaxX, x);
          p2MinY = Math.min(p2MinY, y);
          p2MaxY = Math.max(p2MaxY, y);
        }
      }
    }
  }

  console.log('Photo 1 (Akua Foriwaa):', { x: p1MinX, y: p1MinY, width: p1MaxX - p1MinX, height: p1MaxY - p1MinY });
  console.log('Photo 2 (Lydia Appiagyei):', { x: p2MinX, y: p2MinY, width: p2MaxX - p2MinX, height: p2MaxY - p2MinY });
}

findBBoxes();
