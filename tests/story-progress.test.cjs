const assert = require("node:assert/strict")
const test = require("node:test")
const loadSource = require("./load-source.cjs")
const { findStoryProgress } = loadSource(
  "src/features/instagram/media/story-progress.ts"
)

function fixture({
  timestamp = true,
  role = null,
  top = 4,
  width = 344,
  videos = 1,
  opacity = "1",
  marked = false,
  excluded = false
} = {}) {
  const rect = {
    left: 8,
    right: 8 + width,
    top,
    bottom: top + 3,
    width,
    height: 3
  }
  const strip = {
    children: [
      { getBoundingClientRect: () => ({ ...rect, width: width / 2 }) }
    ],
    getBoundingClientRect: () => rect,
    closest: () => excluded,
    getAttribute: () => role,
    hasAttribute: () => marked
  }
  const scope = {
    tagName: "DIV",
    parentElement: null,
    querySelector: () => (timestamp ? {} : null),
    querySelectorAll: (selector) =>
      selector === "video" ? Array(videos).fill({}) : [strip]
  }
  const media = {
    isConnected: true,
    parentElement: scope,
    getBoundingClientRect: () => ({
      left: 0,
      right: 360,
      top: 0,
      bottom: 600,
      width: 360,
      height: 600
    }),
    ownerDocument: {
      defaultView: {
        getComputedStyle: () => ({
          visibility: "visible",
          display: "flex",
          opacity
        })
      }
    }
  }
  return { media, strip }
}

test("Story strips require a scoped timestamp/segments or an explicit progress role", () => {
  for (const options of [
    {},
    { timestamp: false, role: "progressbar" },
    { opacity: "0", marked: true }
  ]) {
    const { media, strip } = fixture(options)
    assert.equal(findStoryProgress(media), strip)
  }
  for (const options of [
    { timestamp: false },
    { top: 590 },
    { width: 100 },
    { videos: 2 },
    { opacity: "0" },
    { excluded: true }
  ])
    assert.equal(findStoryProgress(fixture(options).media), null)
})
test("detached Story media cannot acquire a native progress strip", () => {
  const { media } = fixture()
  media.isConnected = false
  assert.equal(findStoryProgress(media), null)
})
