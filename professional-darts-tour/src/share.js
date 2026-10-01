// Share a piece of the screen as a picture: native share sheet on phones, the Web Share API
// where the browser supports files, otherwise a PNG download.
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export async function shareImage(node, { name = 'professional-darts-tour', title = 'Professional Darts Tour', text = '' } = {}) {
  const { toPng } = await import('html-to-image')
  const bg = getComputedStyle(document.body).backgroundColor || '#000'
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: bg, cacheBust: true })
  const file = `${name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.png`
  if (Capacitor.isNativePlatform()) {
    const saved = await Filesystem.writeFile({ path: file, data: dataUrl.split(',')[1], directory: Directory.Cache })
    await Share.share({ title, text, files: [saved.uri] })
    return 'shared'
  }
  const blob = await (await fetch(dataUrl)).blob()
  const f = new File([blob], file, { type: 'image/png' })
  if (navigator.canShare?.({ files: [f] })) {
    try {
      await navigator.share({ title, text, files: [f] })
      return 'shared'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = file
  document.body.appendChild(a)
  a.click()
  a.remove()
  return 'downloaded'
}
