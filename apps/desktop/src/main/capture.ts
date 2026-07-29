import {
  desktopCapturer,
  nativeImage,
  screen,
  systemPreferences,
  type Display,
  type NativeImage,
  type Rectangle
} from 'electron'
import type { CaptureRegion } from '@haired/contracts'

export interface CapturedDisplay {
  display: Display
  image: NativeImage
}

export interface PixelCrop {
  x: number
  y: number
  width: number
  height: number
}

export function screenCaptureFailureMessage(
  permission: string,
  fallback = 'Screen capture could not start'
): string {
  if (permission === 'denied' || permission === 'restricted') {
    return 'Screen capture access is blocked. Enable Haired in System Settings → Privacy & Security → Screen & System Audio Recording, then restart Haired.'
  }
  if (permission === 'not-determined') {
    return 'Screen capture access has not been granted yet. Allow it in macOS, then restart Haired.'
  }
  if (permission === 'granted') {
    return 'macOS reports screen capture access as granted, but this running Haired process cannot use it yet. Restart Haired and try the shortcut again.'
  }
  return fallback
}

export function calculatePixelCrop(
  region: CaptureRegion,
  displayBounds: Rectangle,
  imageSize: { width: number; height: number }
): PixelCrop {
  const scaleX = imageSize.width / displayBounds.width
  const scaleY = imageSize.height / displayBounds.height
  const x = Math.max(0, Math.round(region.x * scaleX))
  const y = Math.max(0, Math.round(region.y * scaleY))
  const width = Math.min(imageSize.width - x, Math.max(1, Math.round(region.width * scaleX)))
  const height = Math.min(
    imageSize.height - y,
    Math.max(1, Math.round(region.height * scaleY))
  )
  return { x, y, width, height }
}

export function constrainedSize(
  width: number,
  height: number,
  maxEdge = 4_096,
  maxPixels = 8_000_000
): { width: number; height: number } {
  const edgeScale = Math.min(1, maxEdge / Math.max(width, height))
  const pixelScale = Math.min(1, Math.sqrt(maxPixels / (width * height)))
  const scale = Math.min(edgeScale, pixelScale)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

export async function captureDisplayAtPointer(): Promise<CapturedDisplay> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const requestedSize = {
    width: Math.max(1, Math.round(display.bounds.width * display.scaleFactor)),
    height: Math.max(1, Math.round(display.bounds.height * display.scaleFactor))
  }
  let sources
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: requestedSize,
      fetchWindowIcons: false
    })
  } catch (error) {
    if (process.platform === 'darwin') {
      throw new Error(
        screenCaptureFailureMessage(
          systemPreferences.getMediaAccessStatus('screen'),
          error instanceof Error ? error.message : 'Screen capture could not start'
        )
      )
    }
    throw error
  }
  const source =
    sources.find((candidate) => candidate.display_id === String(display.id)) ??
    sources.find((candidate) => candidate.name.includes(String(display.id))) ??
    sources[0]
  if (!source || source.thumbnail.isEmpty()) throw new Error('Unable to capture the current display')
  return { display, image: source.thumbnail }
}

export function cropCapture(capture: CapturedDisplay, region: CaptureRegion): Buffer {
  if (region.width < 8 || region.height < 8) {
    throw new Error('Select a region at least 8 by 8 pixels')
  }
  const crop = calculatePixelCrop(region, capture.display.bounds, capture.image.getSize())
  let image = capture.image.crop(crop)
  const current = image.getSize()
  const constrained = constrainedSize(current.width, current.height)
  if (constrained.width !== current.width || constrained.height !== current.height) {
    image = image.resize({ ...constrained, quality: 'best' })
  }
  const png = image.toPNG()
  if (png.length > 10 * 1024 * 1024) {
    const reduced = nativeImage
      .createFromBuffer(png)
      .resize({
        ...constrainedSize(constrained.width, constrained.height, 3_072, 5_000_000),
        quality: 'best'
      })
      .toPNG()
    if (reduced.length > 10 * 1024 * 1024) {
      throw new Error('Selected region is too large to analyze securely')
    }
    return reduced
  }
  return png
}
