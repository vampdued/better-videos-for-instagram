import {
  getActiveInstagramVideo,
  getVisibleMediaDialog,
  isVideoInViewport
} from "../media/video"
import { getVideoContainer } from "@/utils/media/container"
import { settings } from "@/utils/storage/settings"
import { createSettingStore } from "@/utils/storage/setting"

// Protect one already-playing, selected source. Enabling the preference never
// starts media, and Explore previews are excluded because they are not injected.
export function observeBackgroundPlayback(doc: Document = document) {
  const preference = createSettingStore(settings.backgroundPlayback)
  let source: HTMLVideoElement | null = null
  let selected: HTMLVideoElement | null = null
  const clear = () => {
    source?.removeAttribute("data-bigv-background-playing")
    source = null
  }
  const sync = () => {
    if (!preference.getSnapshot()) {
      clear()
      return
    }
    const dialog = getVisibleMediaDialog(doc)
    const available = Array.from(
      doc.querySelectorAll<HTMLVideoElement>("video[bigv-injected]")
    ).filter(
      (video) =>
        video.isConnected &&
        isVideoInViewport(video) &&
        (!dialog || dialog.contains(video)) &&
        (!doc.fullscreenElement || doc.fullscreenElement.contains(video))
    )
    const preferred = doc.hidden && source ? source : selected
    const next =
      preferred && available.includes(preferred)
        ? preferred
        : getActiveInstagramVideo(available)
    if (next !== source) clear()
    if (!next || next.paused || next.ended) {
      clear()
      return
    }
    source = next
    source.setAttribute("data-bigv-background-playing", "true")
  }
  const select = (event: Event) => {
    if (!(event.target instanceof Element)) return
    const target = event.target
    selected =
      Array.from(
        doc.querySelectorAll<HTMLVideoElement>("video[bigv-injected]")
      ).find((video) => getVideoContainer(video)?.contains(target)) ?? null
    sync()
  }
  const events = [
    "play",
    "pause",
    "ended",
    "emptied",
    "bigv-activechange",
    "visibilitychange",
    "scroll"
  ]
  for (const event of events) doc.addEventListener(event, sync, true)
  doc.addEventListener("pointerdown", select, true)
  const observer = new MutationObserver(sync)
  observer.observe(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["bigv-injected", "aria-hidden"]
  })
  const stopSetting = preference.subscribe(sync)
  sync()
  return () => {
    stopSetting()
    observer.disconnect()
    for (const event of events) doc.removeEventListener(event, sync, true)
    doc.removeEventListener("pointerdown", select, true)
    selected = null
    clear()
  }
}
