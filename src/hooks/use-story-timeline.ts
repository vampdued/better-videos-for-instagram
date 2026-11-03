import { useEffect, useState } from "react"
import { findStoryProgress } from "@/features/instagram/media/story-progress"

export function useStoryTimeline(
  video: HTMLVideoElement | HTMLImageElement,
  controllerId: string,
  replaceNative = true
) {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const doc = video.ownerDocument
    const win = doc.defaultView
    if (!doc.getElementById(controllerId) || !win) return
    let native: HTMLElement | null = null
    let mount: HTMLElement | null = null
    let frame = 0
    const restore = () => {
      if (native?.getAttribute("data-bigv-story-progress") === controllerId)
        native.removeAttribute("data-bigv-story-progress")
      mount?.remove()
      mount = null
    }
    const update = () => {
      frame = 0
      let next = findStoryProgress(video)
      if (doc.fullscreenElement && !doc.fullscreenElement.contains(next))
        next = null
      if (next !== native) {
        restore()
        native = next
      }
      if (next) {
        // Own both the header and media layers: controls inside the media's
        // stacking context can be partially covered by Instagram's header.
        let parent = next.parentElement
        while (parent && !parent.contains(video)) parent = parent.parentElement
        if (!parent) next = null
        else {
          if (!mount || mount.parentElement !== parent) {
            mount?.remove()
            mount = doc.createElement("div")
            mount.className = "bigv-controller-host bigv-story-timeline-host"
            mount.setAttribute("data-bigv-controller", "")
            mount.setAttribute("data-bigv-story-timeline-owner", controllerId)
            parent.append(mount)
          }
          // Measure the containing block without repositioning Instagram's
          // nodes. Account for transforms on the header's ancestors as well.
          const rect = next.getBoundingClientRect()
          const media = video.getBoundingClientRect()
          mount.style.cssText =
            "inset:auto;left:0;top:0;width:1px;height:1px;z-index:2147483646"
          const origin = mount.getBoundingClientRect()
          if (origin.width <= 0 || origin.height <= 0) next = null
          else {
            mount.style.left = `${(media.left - origin.left) / origin.width}px`
            mount.style.top = `${(media.top - origin.top) / origin.height}px`
            mount.style.width = `${media.width / origin.width}px`
            mount.style.height = `${media.height / origin.height}px`
            mount.style.setProperty(
              "--bigv-story-timeline-left",
              `${(rect.left - media.left) / origin.width}px`
            )
            mount.style.setProperty(
              "--bigv-story-timeline-top",
              `${(rect.top - media.top) / origin.height}px`
            )
            mount.style.setProperty(
              "--bigv-story-timeline-width",
              `${rect.width / origin.width}px`
            )
            if (replaceNative)
              native?.setAttribute("data-bigv-story-progress", controllerId)
          }
        }
      }
      if (!next) {
        restore()
        native = null
      }
      setTarget(mount)
    }
    const schedule = () => {
      if (!frame) frame = win.requestAnimationFrame(update)
    }
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            !(record.target instanceof Element) ||
            !record.target.closest("[data-bigv-controller]")
        )
      )
        schedule()
    })
    observer.observe(doc.body, { childList: true, subtree: true })
    const resize = new ResizeObserver(schedule)
    resize.observe(video)
    win.addEventListener("resize", schedule)
    doc.addEventListener("fullscreenchange", schedule)
    const timer = win.setInterval(schedule, 500)
    update()
    return () => {
      observer.disconnect()
      resize.disconnect()
      win.cancelAnimationFrame(frame)
      win.clearInterval(timer)
      win.removeEventListener("resize", schedule)
      doc.removeEventListener("fullscreenchange", schedule)
      restore()
    }
  }, [video, controllerId, replaceNative])
  return target
}
