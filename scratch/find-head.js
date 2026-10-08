const sharp = require('sharp');

async function findHead() {
  const image = sharp('C:/Users/emman/.gemini/antigravity-ide/brain/474fe5a2-1447-41dc-96a2-937c5532150b/.user_uploaded/media_1791434696212.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, channels } = info;

  // Let's find first non-white pixel in x in 120..180 for y from 100 to 220
  for (let y = 140; y < 220; y++) {
    for (let x = 120; x < 180; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx+1], b = data[idx+2];
      if (r < 240 || g < 240 || b < 240) {
        console.log(`Found non-white at y=${y}, x=${x}: RGB(${r},${g},${b})`);
        return;
      }
    }
  }
}
findHead();
