const sharp = require('sharp');
const path = require('path');

async function convertFavicon() {
  try {
    const svgPath = path.join(__dirname, 'public', 'favicon.svg');
    const pngPath = path.join(__dirname, 'public', 'apple-touch-icon.png');
    
    // Convert SVG to 180x180 PNG (iOS standard size)
    await sharp(svgPath)
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png()
      .toFile(pngPath);
    
    console.log('✓ Converted favicon.svg to apple-touch-icon.png (180x180)');
  } catch (error) {
    console.error('✗ Error converting favicon:', error);
    process.exit(1);
  }
}

convertFavicon();

