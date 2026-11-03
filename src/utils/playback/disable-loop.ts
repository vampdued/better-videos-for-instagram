// Keep native completion (including Reels auto-skip) and explicit replay intact.
// Restore Instagram's latest preference when the setting/owner is removed.
// The document_start MAIN guard also blocks scripted rewinds and ended replay
// while this marker is present; an attribute observer alone cannot stop those.
export function disableVideoLoop(video: HTMLVideoElement) {
  video.setAttribute("data-bigv-loop-disabled", "true")
  let requestedLoop = video.getAttribute("loop")
  const options = { attributes: true, attributeFilter: ["loop"] }
  const enforce = () => {
    observer.disconnect()
    video.removeAttribute("loop")
    observer.observe(video, options)
  }
  const observer = new MutationObserver(() => {
    requestedLoop = video.getAttribute("loop")
    enforce()
  })
  enforce()
  return () => {
    // A site write immediately before cleanup may still be queued.
    if (observer.takeRecords().length)
      requestedLoop = video.getAttribute("loop")
    observer.disconnect()
    video.removeAttribute("data-bigv-loop-disabled")
    video.removeAttribute("data-bigv-loop-ended")
    if (requestedLoop === null) video.removeAttribute("loop")
    else video.setAttribute("loop", requestedLoop)
  }
}
