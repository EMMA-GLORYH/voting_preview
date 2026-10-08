const sharp = require('sharp');
const fs = require('fs');

async function extractExactPhotos() {
  if (!fs.existsSync('public/candidates')) {
    fs.mkdirSync('public/candidates', { recursive: true });
  }

  // Photo 1: Akua Foriwaa (width 135, height 152) -> resize to high-res 400x450
  await sharp('C:/Users/emman/.gemini/antigravity-ide/brain/474fe5a2-1447-41dc-96a2-937c5532150b/.user_uploaded/media_1791434696212.png')
    .extract({ left: 90, top: 138, width: 135, height: 152 })
    .resize(400, 450, { fit: 'cover' })
    .toFile('public/candidates/akua-foriwaa.png');

  // Photo 2: Lydia Appiagyei (width 135, height 152) -> resize to high-res 400x450
  await sharp('C:/Users/emman/.gemini/antigravity-ide/brain/474fe5a2-1447-41dc-96a2-937c5532150b/.user_uploaded/media_1791434696212.png')
    .extract({ left: 90, top: 383, width: 135, height: 152 })
    .resize(400, 450, { fit: 'cover' })
    .toFile('public/candidates/lydia-appiagyei.png');

  console.log('Saved exact candidate photos for Akua Foriwaa and Lydia Appiagyei!');
}

extractExactPhotos();
