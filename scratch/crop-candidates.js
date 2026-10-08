const sharp = require('sharp');
const fs = require('fs');

async function crop() {
  if (!fs.existsSync('public/candidates')) {
    fs.mkdirSync('public/candidates', { recursive: true });
  }

  // Photo 1: Akua Foriwaa
  // In the image, the blue rectangle border is around x=90..225, y=193..408
  await sharp('C:/Users/emman/.gemini/antigravity-ide/brain/474fe5a2-1447-41dc-96a2-937c5532150b/.user_uploaded/media_1791434696212.png')
    .extract({ left: 93, top: 194, width: 132, height: 214 })
    .toFile('public/candidates/akua-foriwaa.png');

  // Photo 2: Lydia Appiagyei
  await sharp('C:/Users/emman/.gemini/antigravity-ide/brain/474fe5a2-1447-41dc-96a2-937c5532150b/.user_uploaded/media_1791434696212.png')
    .extract({ left: 93, top: 540, width: 132, height: 168 })
    .toFile('public/candidates/lydia-appiagyei.png');

  console.log('Cropped successfully!');
}

crop();
