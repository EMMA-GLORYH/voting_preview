const sharp = require('sharp');
const fs = require('fs');

async function detectBoxes() {
  const image = sharp('C:/Users/emman/.gemini/antigravity-ide/brain/474fe5a2-1447-41dc-96a2-937c5532150b/.user_uploaded/media_1791434696212.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Let's sample along x=150 (vertical line through the photos) to find top and bottom of each photo
  for (let y = 0; y < height; y++) {
    const idx = (y * width + 150) * channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const isWhite = r > 240 && g > 240 && b > 240;
    if (!isWhite) {
      console.log(`Non-white at y=${y}: RGB(${r}, ${g}, ${b})`);
    }
  }
}

detectBoxes();
