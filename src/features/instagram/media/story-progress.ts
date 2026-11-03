// Native Story strips have thin, horizontally arranged segments above the
// timestamp. Scope discovery to the current media; never use generated classes.
export function findStoryProgress(
  video: HTMLVideoElement | HTMLImageElement
): HTMLElement | null {
  const win = video.ownerDocument.defaultView
  if (!win || !video.isConnected) return null
  const media = video.getBoundingClientRect()
  const checked = new Set<HTMLElement>()
  for (let scope = video.parentElement; scope; scope = scope.parentElement) {
    if (/^(BODY|HTML|MAIN)$/.test(scope.tagName)) break
    if (scope.querySelectorAll("video").length > 1) break
    const timestamp = scope.querySelector("time")
    for (const node of scope.querySelectorAll<HTMLElement>(
      'div, [role="progressbar"]'
    )) {
      if (checked.has(node)) continue
      checked.add(node)
      if (node.closest('[data-bigv-controller], [aria-hidden="true"]')) continue
      const rect = node.getBoundingClientRect()
      if (
        rect.width < media.width * 0.65 ||
        rect.width > media.width * 1.05 ||
        rect.height < 1 ||
        rect.height > 12 ||
        rect.left < media.left - 2 ||
        rect.right > media.right + 2 ||
        rect.top < media.top - 2 ||
        rect.bottom > media.top + 80
      )
        continue
      const style = win.getComputedStyle(node)
      if (
        style.visibility === "hidden" ||
        style.display === "none" ||
        (style.opacity === "0" &&
          !node.hasAttribute("data-bigv-story-progress"))
      )
        continue
      const segments = Array.from(node.children)
      const segmented =
        timestamp &&
        segments.length > 0 &&
        segments.every((child) => {
          const part = child.getBoundingClientRect()
          return (
            part.width >= 8 &&
            part.height >= 1 &&
            part.height <= 12 &&
            part.top >= rect.top - 1 &&
            part.bottom <= rect.bottom + 1
          )
        })
      if (node.getAttribute("role") === "progressbar" || segmented) return node
    }
  }
  return null
}
