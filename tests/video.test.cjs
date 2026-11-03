const assert = require("node:assert/strict")
const test = require("node:test")
const loadSource = require("./load-source.cjs")

function video({
  top = 100,
  left = 100,
  width = 400,
  height = 600,
  paused = false,
  hidden = false,
  src = "blob:reel"
} = {}) {
  return {
    src,
    currentSrc: src,
    paused,
    ended: false,
    readyState: 4,
    closest: () => (hidden ? {} : null),
    getBoundingClientRect: () => ({
      top,
      left,
      width,
      height,
      right: left + width,
      bottom: top + height
    })
  }
}

const {
  getActiveInstagramVideo,
  isInstagramVideo,
  getVisibleMediaDialog,
  pauseVideosOutsideDialog
} = loadSource("src/features/instagram/media/video.ts", {
  URL,
  window: { innerWidth: 1200, innerHeight: 800 }
})

test("Instagram CDN HTTPS sources and source-element currentSrc are supported", () => {
  for (const src of [
    "https://scontent.cdninstagram.com/video.mp4",
    "https://video.xx.fbcdn.net/clip.mp4",
    "https://www.instagram.com/video.mp4"
  ])
    assert.equal(isInstagramVideo(video({ src })), true)
  assert.equal(
    isInstagramVideo({
      ...video({ src: "" }),
      currentSrc: "https://scontent.cdninstagram.com/video.mp4"
    }),
    true
  )
  assert.equal(
    isInstagramVideo(video({ src: "https://evilcdninstagram.com/video.mp4" })),
    false
  )
  assert.equal(
    isInstagramVideo(
      video({ src: "https://cdninstagram.com.evil.test/video.mp4" })
    ),
    false
  )
})

test("offscreen playback does not outrank a visible paused Reel", () => {
  const visible = video({ paused: true })
  assert.equal(getActiveInstagramVideo([video({ top: 900 }), visible]), visible)
})

test("no active video when all candidates are hidden, offscreen or empty", () => {
  assert.equal(
    getActiveInstagramVideo([
      video({ top: -700 }),
      video({ left: 1500 }),
      video({ hidden: true }),
      video({ width: 0 })
    ]),
    null
  )
  assert.equal(getActiveInstagramVideo([]), null)
})

test("visible playing videos take priority over paused videos", () => {
  const playing = video({ top: 400 })
  assert.equal(
    getActiveInstagramVideo([video({ paused: true }), playing]),
    playing
  )
})

test("the most visible playing video wins regardless of DOM order", () => {
  const centered = video()
  const edge = video({ top: 550 })
  assert.equal(getActiveInstagramVideo([edge, centered]), centered)
  assert.equal(getActiveInstagramVideo([centered, edge]), centered)
})

test("unrelated non-Instagram videos are ignored", () => {
  assert.equal(
    getActiveInstagramVideo([video({ src: "https://example.test/video.mp4" })]),
    null
  )
})

test("each candidate's geometry is read once per selection", () => {
  let reads = 0
  const candidate = video()
  const rect = candidate.getBoundingClientRect()
  candidate.getBoundingClientRect = () => {
    reads += 1
    return rect
  }
  getActiveInstagramVideo([candidate])
  assert.equal(reads, 1)
})

test("an opened media dialog outranks playing previews and only background Instagram media is paused", () => {
  const preview = video()
  const opened = video({ paused: true })
  const unrelated = video({ src: "https://example.test/video.mp4" })
  const all = [preview, opened, unrelated]
  for (const item of all)
    item.pause = () => {
      item.paused = true
    }
  const dialog = {
    getClientRects: () => [{}],
    querySelectorAll: () => [opened],
    contains: (item) => item === opened
  }
  const doc = {
    querySelectorAll: (selector) => (selector === "video" ? all : [dialog])
  }
  for (const item of [...all, dialog]) item.ownerDocument = doc
  assert.equal(getActiveInstagramVideo(all), opened)
  pauseVideosOutsideDialog(getVisibleMediaDialog(doc))
  assert.equal(preview.paused, true)
  assert.equal(opened.paused, true)
  assert.equal(unrelated.paused, false)
  doc.fullscreenElement = {}
  assert.equal(
    getVisibleMediaDialog(doc),
    null,
    "explicit fullscreen takes priority"
  )
  delete doc.fullscreenElement
  dialog.querySelectorAll = () => []
  assert.equal(
    getVisibleMediaDialog(doc),
    null,
    "comments-only dialogs do not suppress playback"
  )
})
