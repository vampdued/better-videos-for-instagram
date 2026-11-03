export function allowVideoReplay(video: HTMLVideoElement) {
  if (video.getAttribute("data-bigv-loop-ended") !== "true") return
  video.removeAttribute("data-bigv-loop-ended")
  setVideoTime(video, 0)
}

export function setVideoTime(video: HTMLVideoElement, time: number) {
  video.removeAttribute("data-bigv-loop-ended")
  video.setAttribute("data-bigv-user-seeking", "true")
  try {
    video.currentTime = time
  } finally {
    video.removeAttribute("data-bigv-user-seeking")
  }
}

export function setVideoPlaying(video: HTMLVideoElement, playing: boolean) {
  if (playing) allowVideoReplay(video)
  if (video.hasAttribute("data-bigv-background-playing"))
    video.setAttribute("data-bigv-background-playing", String(playing))
  if (video.hasAttribute("data-bigv-fullscreen-source"))
    video.setAttribute("data-bigv-fullscreen-playing", String(playing))
  if (playing) return video.play().catch(() => {})
  video.pause()
}

export function prepareFullscreenVideo(video: HTMLVideoElement) {
  video.setAttribute("data-bigv-fullscreen-source", "true")
  video.setAttribute("data-bigv-fullscreen-playing", String(!video.paused))
  return () => {
    video.removeAttribute("data-bigv-fullscreen-source")
    video.removeAttribute("data-bigv-fullscreen-playing")
  }
}
