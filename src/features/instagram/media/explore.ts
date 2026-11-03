// Explore grid videos are previews, including hover previews without links.
// Recheck their scope because Instagram can move them into an opened player.
export function isExplorePreview(video: HTMLVideoElement): boolean {
  const doc = video.ownerDocument
  return (
    /^\/explore(?:\/|$)/.test(doc.location.pathname) &&
    !video.closest('[role="dialog"], [aria-modal="true"], dialog') &&
    !doc.fullscreenElement?.contains(video)
  )
}
