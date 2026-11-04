const assert = require("node:assert/strict")
const test = require("node:test")
const loadSource = require("./load-source.cjs")
const { shouldEnhanceInstagramVideo, isInstagramMessageContext } = loadSource(
  "src/features/instagram/media/player-context.ts"
)

const video = (pathname, controls = false) => ({
  controls,
  ownerDocument: { location: { pathname } }
})

test("loaded audio-only Direct messages retain playback controls without enabling uploads, GIFs or native viewers", () => {
  const music = {
    ...video("/direct/t/fixture/"),
    readyState: 4,
    videoWidth: 0,
    videoHeight: 0,
    closest: (selector) => (selector.startsWith("article") ? {} : null)
  }
  assert.equal(shouldEnhanceInstagramVideo(music), true)
  for (const invalid of [
    { readyState: 0 },
    { videoWidth: 320, videoHeight: 240 },
    { controls: true },
    { closest: () => null },
    { closest: () => ({}) }
  ])
    assert.equal(shouldEnhanceInstagramVideo({ ...music, ...invalid }), false)
})

test("Direct attachment previews, messages and GIF videos keep native behavior", () => {
  for (const route of [
    "/direct/",
    "/direct/inbox/",
    "/direct/t/fixture/",
    "/direct/new/"
  ])
    assert.equal(shouldEnhanceInstagramVideo(video(route)), false)
})

test("native controls are preserved while Feed, Reel, Story and profile players remain eligible", () => {
  for (const route of [
    "/",
    "/p/fixture/",
    "/reels/fixture/",
    "/stories/fixture/1/",
    "/fixture/reels/"
  ]) {
    assert.equal(shouldEnhanceInstagramVideo(video(route)), true)
    assert.equal(shouldEnhanceInstagramVideo(video(route, true)), false)
  }
  assert.equal(
    shouldEnhanceInstagramVideo(video("/direct-not-messages/")),
    true
  )
})

test("floating message articles are recognized without a Direct URL and music remains eligible", () => {
  for (const route of ["/", "/reels/fixture/", "/p/fixture/"]) {
    const message = {
      ...video(route),
      readyState: 4,
      videoWidth: 350,
      videoHeight: 200,
      closest: (selector) =>
        selector.startsWith('[role="article"]') ||
        selector.startsWith("article")
          ? {}
          : null
    }
    assert.equal(isInstagramMessageContext(message), true)
    assert.equal(shouldEnhanceInstagramVideo(message), false)
    const music = { ...message, videoWidth: 0, videoHeight: 0 }
    assert.equal(shouldEnhanceInstagramVideo(music), true)
    assert.equal(
      shouldEnhanceInstagramVideo({ ...music, controls: true }),
      false
    )
  }
})

test("floating chat composer previews are excluded using the scoped chat surface", () => {
  const surface = {
    matches: () => false,
    hasAttribute: () => true,
    querySelector: () => ({}),
    parentElement: null
  }
  const upload = { ...video("/reels/fixture/"), parentElement: surface }
  assert.equal(shouldEnhanceInstagramVideo(upload), false)
  surface.hasAttribute = () => false
  assert.equal(shouldEnhanceInstagramVideo(upload), true)
  surface.hasAttribute = () => true
  surface.matches = () => true
  assert.equal(
    shouldEnhanceInstagramVideo(upload),
    true,
    "never match the page's main/root surface"
  )
})
