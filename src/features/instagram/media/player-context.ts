// Direct owns its attachment composer, GIFs and media viewer. Its music messages
// use audio-only video elements and still need volume and playback controls.
export const isInstagramDirectPage = (pathname: string) =>
  /^\/direct(?:\/|$)/.test(pathname)

export function isInstagramMessageContext(element: Element): boolean {
  if (
    isInstagramDirectPage(element.ownerDocument?.location?.pathname ?? "") ||
    element.closest?.('[role="article"][aria-roledescription], [role="log"]')
  )
    return true

  // Floating Direct chats live beside Feed/Reels without changing the URL.
  // The named chat surface also encloses its composer and attachment previews.
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.matches('body, html, main, [role="main"]')) break
    if (
      node.hasAttribute("aria-label") &&
      node.querySelector('input[type="file"]') &&
      node.querySelector('[contenteditable="true"], textarea, [role="textbox"]')
    )
      return true
  }
  return false
}

export function isInstagramDirectAudioMessage(
  video: HTMLVideoElement
): boolean {
  return (
    isInstagramMessageContext(video) &&
    !video.controls &&
    video.readyState >= 1 &&
    video.videoWidth === 0 &&
    video.videoHeight === 0 &&
    !!video.closest('article, [role="article"]') &&
    !video.closest('form, [role="dialog"], [aria-modal="true"], dialog')
  )
}

export function shouldEnhanceInstagramVideo(video: HTMLVideoElement): boolean {
  return (
    !video.controls &&
    (!isInstagramMessageContext(video) || isInstagramDirectAudioMessage(video))
  )
}
