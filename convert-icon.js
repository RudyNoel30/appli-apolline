import sharp from 'sharp';

sharp('src-tauri/app-icon.svg', {
  density: 300 // Very high quality
})
  .png({
    compressionLevel: 9,
    force: true
  })
  .toFile('app-icon.png')
  .then(() => {
    console.log('✓ app-icon.svg convertie en app-icon.png');
  })
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
