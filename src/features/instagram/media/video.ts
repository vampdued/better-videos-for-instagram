import { getVideoSource } from "../bridges/spritesheet-client"

export function getInstagramVideoSourceType(
  video: HTMLVideoElement
): "blob" | "https" | "mediaSourceHandle" | null {
  if (video.closest?.("[bigv-inject], [data-bigv-pip-mirror]")) return null
  // Worker-backed MSE has no media URL. Inspect the public browser interface
  // in this world; do not depend on page globals or accept camera/call streams.
  if (video.srcObject != null)
    return typeof MediaSourceHandle !== "undefined" &&
      video.srcObject instanceof MediaSourceHandle
      ? "mediaSourceHandle"
      : null
  const source = getVideoSource(video)
  if (source.startsWith("blob:")) return "blob"
  try {
    const url = new URL(source)
    return url.protocol === "https:" &&
      /(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)
      ? "https"
      : null
  } catch {
    return null
  }
}

export function isInstagramVideo(video: HTMLVideoElement) {
  return getInstagramVideoSourceType(video) !== null
}

export function isVideoInViewport(video: HTMLVideoElement) {
  if (video.closest('[aria-hidden="true"]')) return false

  const rect = video.getBoundingClientRect()

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  )
}

export function getVideoVisibilityScore(video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect()

  if (rect.width <= 0 || rect.height <= 0) return 0

  const visibleWidth =
    Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)
  const visibleHeight =
    Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)

  if (visibleWidth <= 0 || visibleHeight <= 0) return 0

  const visibleRatio =
    (visibleWidth * visibleHeight) / (rect.width * rect.height)
  const videoCenter = rect.top + rect.height / 2
  const viewportCenter = window.innerHeight / 2
  const centerPenalty =
    Math.abs(videoCenter - viewportCenter) / Math.max(window.innerHeight, 1)

  return Math.max(visibleRatio - centerPenalty, 0)
}

export function getVisibleMediaDialog(doc: Document): HTMLElement | null {
  if (doc.fullscreenElement) return null
  return (
    Array.from(
      doc.querySelectorAll<HTMLElement>(
        '[role="dialog"], [aria-modal="true"], dialog[open]'
      )
    ).find(
      (dialog) =>
        dialog.getClientRects().length > 0 &&
        Array.from(dialog.querySelectorAll("video")).some(
          (video) => isInstagramVideo(video) && isVideoInViewport(video)
        )
    ) ?? null
  )
}

export function pauseVideosOutsideDialog(dialog: HTMLElement | null) {
  if (!dialog) return
  for (const video of dialog.ownerDocument.querySelectorAll("video"))
    if (!dialog.contains(video) && isInstagramVideo(video) && !video.paused)
      video.pause()
}

export function getActiveInstagramVideo(
  videos: Iterable<HTMLVideoElement> = document.querySelectorAll<HTMLVideoElement>(
    "video"
  )
) {
  const candidates = Array.from(videos)
  const doc = candidates[0]?.ownerDocument
  const dialog = doc ? getVisibleMediaDialog(doc) : null
  let activeVideo: HTMLVideoElement | null = null
  let activeScore = 0
  let activePlaying = false

  for (const video of candidates) {
    if (
      (dialog && !dialog.contains(video)) ||
      !isInstagramVideo(video) ||
      video.closest('[aria-hidden="true"]')
    )
      continue

    const score = getVideoVisibilityScore(video)
    if (score <= 0) continue
    const playing = !video.paused && !video.ended && video.readyState > 0

    if (
      !activeVideo ||
      (playing && !activePlaying) ||
      (playing === activePlaying && score > activeScore)
    ) {
      activeVideo = video
      activeScore = score
      activePlaying = playing
    }
  }

  return activeVideo
}
