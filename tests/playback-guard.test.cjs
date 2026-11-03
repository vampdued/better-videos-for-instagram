const assert = require("node:assert/strict")
const test = require("node:test")
const loadSource = require("./load-source.cjs")
const { setVideoPlaying, setVideoTime } = loadSource(
  "src/utils/fullscreen/playback.ts"
)

function setup() {
  class Media {
    attrs = new Map()
    time = 0
    duration = 10
    paused = true
    plays = 0
    pauses = 0
    get currentTime() {
      return this.time
    }
    set currentTime(value) {
      this.time = value
    }
    get ended() {
      return this.time >= this.duration
    }
    getAttribute(name) {
      return this.attrs.get(name) ?? null
    }
    hasAttribute(name) {
      return this.attrs.has(name)
    }
    setAttribute(name, value) {
      this.attrs.set(name, value)
    }
    removeAttribute(name) {
      this.attrs.delete(name)
    }
    play() {
      this.plays++
      this.paused = false
      return Promise.resolve()
    }
    pause() {
      this.pauses++
      this.paused = true
    }
  }
  class Video extends Media {}
  const events = new Map()
  const doc = {
    hidden: true,
    hasFocus: () => false,
    addEventListener(name, fn) {
      if (!events.has(name)) events.set(name, [])
      events.get(name).push(fn)
    },
    querySelector: () => null
  }
  loadSource("src/features/instagram/bridges/pip-pause-guard.ts", {
    window: {},
    document: doc,
    HTMLMediaElement: Media,
    HTMLVideoElement: Video
  }).installPipPauseGuard()
  return {
    video: new Video(),
    doc,
    event(name, video) {
      for (const fn of events.get(name) ?? []) fn({ target: video })
    }
  }
}

test("scripted ended replay and rewind are blocked until explicit replay or seeking", async () => {
  const s = setup(),
    v = s.video
  v.setAttribute("data-bigv-loop-disabled", "true")
  v.time = 10
  s.event("ended", v)
  v.currentTime = 0
  await v.play()
  assert.equal(v.currentTime, 10)
  assert.equal(v.plays, 0)
  await setVideoPlaying(v, true)
  assert.equal(v.currentTime, 0)
  assert.equal(v.plays, 1)
  v.time = 10
  s.event("ended", v)
  setVideoTime(v, 5)
  assert.equal(v.currentTime, 5)
  await v.play()
  assert.equal(v.plays, 2)
})

test("a site's pre-end rewind cannot loop; source replacement and opt-out restore native behavior", async () => {
  const s = setup(),
    v = s.video
  v.setAttribute("data-bigv-loop-disabled", "true")
  v.paused = false
  v.time = 9.9
  v.currentTime = 0
  assert.equal(v.currentTime, 9.9)
  v.time = 10
  s.event("ended", v)
  s.event("loadstart", v)
  v.currentTime = 0
  await v.play()
  assert.equal(v.plays, 1)
  v.time = 10
  s.event("ended", v)
  v.removeAttribute("data-bigv-loop-disabled")
  v.currentTime = 0
  await v.play()
  assert.equal(v.plays, 2)
})

test("background protection is opt-in, preserves explicit pause and never overrides completion", async () => {
  const s = setup(),
    v = s.video
  await v.play()
  v.pause()
  assert.equal(v.paused, true)
  await v.play()
  v.setAttribute("data-bigv-background-playing", "true")
  v.pause()
  assert.equal(v.paused, false)
  await setVideoPlaying(v, false)
  assert.equal(v.paused, true)
  await setVideoPlaying(v, true)
  assert.equal(v.getAttribute("data-bigv-background-playing"), "true")
  v.setAttribute("data-bigv-loop-disabled", "true")
  v.time = 10
  s.event("ended", v)
  v.pause()
  await v.play()
  assert.equal(v.paused, true)
})
