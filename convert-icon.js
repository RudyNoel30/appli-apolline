import sharp from 'sharp'

// Prend le logo source (app-icon.png), enlève les bords transparents/blancs, puis
// le centre sur un canvas carré avec un petit padding. Sortie : app-icon-square.png
// utilisée comme entrée par `tauri icon`.
//
// Le trim est essentiel : sans lui, le PNG fourni a 30%+ de marge transparente,
// ce qui rend l'icône minuscule à 32×32 dans la barre des tâches Windows.
const SRC = 'app-icon.png'
const OUT = 'app-icon-square.png'
const PADDING_RATIO = 0.05 // 5% de marge autour du contenu trimé

// 1) Trim des bords transparents (et du fond uni détecté top-left)
const { data, info } = await sharp(SRC).trim().toBuffer({ resolveWithObject: true })

// 2) Calcule la taille carrée cible avec padding léger
const maxSide = Math.max(info.width, info.height)
const padding = Math.round(maxSide * PADDING_RATIO)
const finalSize = maxSide + 2 * padding

// 3) Centre le contenu dans un canvas carré transparent
await sharp(data)
  .resize({
    width: finalSize,
    height: finalSize,
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png({ compressionLevel: 9 })
  .toFile(OUT)

console.log(`✓ ${SRC} → ${OUT} (trim ${info.width}×${info.height} → carré ${finalSize}×${finalSize}, padding ${padding}px)`)
