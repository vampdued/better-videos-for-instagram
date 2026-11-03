export function installPipPauseGuard() {
  const installKey = Symbol.for("better-instagram-videos.pip-pause-guard")
  const guardWindow = window as typeof window & { [key: symbol]: unknown }

  if (!guardWindow[installKey]) {
    guardWindow[installKey] = true
    const documentPrototype =
      typeof Document === "undefined"
        ? Object.getPrototypeOf(document)
        : Document.prototype
    const nativeHidden = Object.getOwnPropertyDescriptor(
      documentPrototype,
      "hidden"
    )?.get
    const nativeVisibility = Object.getOwnPropertyDescriptor(
      documentPrototype,
      "visibilityState"
    )?.get
    const nativeHasFocus = document.hasFocus
    const reallyHidden = () =>
      nativeHidden ? nativeHidden.call(document) : document.hidden
    const reallyFocused = () =>
      nativeHidden ? nativeHasFocus.call(document) : document.hasFocus()
    const documentPipWindow = () =>
      (
        window as typeof window & {
          documentPictureInPicture?: { window?: Window | null }
        }
      ).documentPictureInPicture?.window
    const keepReelsActive = () => {
      const pip = documentPipWindow()
      return Boolean(
        pip &&
        !pip.closed &&
        document.documentElement.getAttribute("data-bigv-pip-reels") === "true"
      )
    }
    // Instagram also gates its Reel pagination on page visibility/focus. During
    // a Reel PiP session the floating player is the user's active viewing surface.
    // Keep native values for the pause guard and restore observable values as
    // soon as that session closes. Feed PiP and ordinary tabs are unaffected.
    if (nativeHidden && nativeVisibility) {
      Object.defineProperties(document, {
        hidden: {
          configurable: true,
          get: () => (keepReelsActive() ? false : nativeHidden.call(document))
        },
        visibilityState: {
          configurable: true,
          get: () =>
            keepReelsActive() ? "visible" : nativeVisibility.call(document)
        },
        hasFocus: {
          configurable: true,
          writable: true,
          value: () => keepReelsActive() || nativeHasFocus.call(document)
        }
      })
    }
    const nativePause = HTMLMediaElement.prototype.pause
    const nativePlay = HTMLMediaElement.prototype.play
    const loopDisabled = (media: HTMLMediaElement) =>
      media instanceof HTMLVideoElement &&
      media.getAttribute("data-bigv-loop-disabled") === "true"
    const loopEnded = (media: HTMLMediaElement) =>
      loopDisabled(media) &&
      media.getAttribute("data-bigv-loop-ended") === "true"
    // Capture before Instagram's ended handlers can rewind and call play().
    document.addEventListener?.(
      "ended",
      (event) => {
        const video = event.target
        if (video instanceof HTMLVideoElement && loopDisabled(video))
          video.setAttribute("data-bigv-loop-ended", "true")
      },
      true
    )
    for (const event of ["emptied", "loadstart"])
      document.addEventListener?.(
        event,
        (event) => {
          if (event.target instanceof HTMLVideoElement)
            event.target.removeAttribute("data-bigv-loop-ended")
        },
        true
      )
    const time = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "currentTime"
    )
    // Native Reels Space/click replay remains an explicit user action too.
    const nativeReplay = (event: Event) => {
      if (
        !event.isTrusted ||
        event.defaultPrevented ||
        !(event.target instanceof Element)
      )
        return
      let video: HTMLVideoElement | null = null
      if (event instanceof KeyboardEvent) {
        if (
          event.key !== " " ||
          event.ctrlKey ||
          event.altKey ||
          event.metaKey ||
          event.shiftKey ||
          event.target.closest(
            'input, textarea, select, button, a[href], [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"], [role="menu"], [role="tablist"]'
          )
        )
          return
        const visible = Array.from(
          document.querySelectorAll<HTMLVideoElement>(
            '[data-bigv-loop-ended="true"]'
          )
        ).filter((video) => {
          const rect = video.getBoundingClientRect()
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth
          )
        })
        if (visible.length === 1) video = visible[0] ?? null
      } else {
        if (
          event instanceof MouseEvent &&
          (event.button !== 0 ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            event.shiftKey)
        )
          return
        video =
          event.target.closest("video") ??
          event.target.closest('[role="button"]')?.querySelector("video") ??
          null
      }
      if (video && loopEnded(video)) {
        video.removeAttribute("data-bigv-loop-ended")
        time?.set?.call(video, 0)
      }
    }
    document.addEventListener?.("click", nativeReplay, true)
    document.addEventListener?.("keydown", nativeReplay, true)
    if (time?.get && time.set) {
      const getTime = time.get
      const setTime = time.set
      Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
        ...time,
        set(value: number) {
          if (
            loopDisabled(this) &&
            this.getAttribute("data-bigv-user-seeking") !== "true" &&
            (loopEnded(this) ||
              (!this.paused &&
                Number.isFinite(this.duration) &&
                this.duration > 0 &&
                getTime.call(this) >= this.duration - 0.2 &&
                value <= 0.1 &&
                value < getTime.call(this)))
          )
            return
          setTime.call(this, value)
        }
      })
    }
    const fullscreenSource = () => {
      const source = document.querySelector?.<HTMLVideoElement>(
        '[data-bigv-fullscreen-source="true"]'
      )
      return source && document.fullscreenElement?.contains(source)
        ? source
        : null
    }
    HTMLMediaElement.prototype.play = function () {
      if (loopEnded(this)) return Promise.resolve()
      const source = fullscreenSource()
      if (source && this instanceof HTMLVideoElement && this !== source)
        return Promise.resolve()
      return nativePlay.call(this)
    }
    HTMLMediaElement.prototype.pause = function () {
      if (
        this instanceof HTMLVideoElement &&
        this.getAttribute("data-bigv-background-playing") === "true" &&
        !this.ended &&
        !loopEnded(this) &&
        (reallyHidden() || !reallyFocused())
      )
        return
      if (
        this === fullscreenSource() &&
        this.getAttribute("data-bigv-fullscreen-playing") === "true" &&
        !this.ended
      )
        return
      const pipWindow = documentPipWindow()
      // Only the opted-in PiP source is protected. Normal Instagram playback,
      // intentional PiP pauses and every other media element keep native behavior.
      if (
        this instanceof HTMLVideoElement &&
        this.getAttribute("data-bigv-pip-playing") === "true" &&
        ((pipWindow && !pipWindow.closed) ||
          document.pictureInPictureElement === this) &&
        !this.ended &&
        (reallyHidden() || !reallyFocused())
      )
        return
      nativePause.call(this)
    }
  }
}
