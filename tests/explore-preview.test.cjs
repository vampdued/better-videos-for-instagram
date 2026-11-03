const assert = require("node:assert/strict")
const test = require("node:test")
const loadSource = require("./load-source.cjs")
const { isExplorePreview } = loadSource(
  "src/features/instagram/media/explore.ts",
  { URL }
)

function video({
  path = "/explore/",
  href = "/reel/preview/",
  dialog = false,
  fullscreen = false
} = {}) {
  return {
    ownerDocument: {
      location: new URL(path, "https://www.instagram.com"),
      fullscreenElement: fullscreen ? { contains: () => true } : null
    },
    closest(selector) {
      return selector === "a[href]" ? href && { href } : dialog
    }
  }
}

test("Explore grid previews keep native behavior, including hover previews without links", () => {
  for (const href of [
    "/p/post/",
    "/reel/reel/",
    "/reels/reel/?x=1",
    "/tv/video/",
    null,
    "/profile/",
    "https://example.com/reel/preview/",
    "http://["
  ])
    assert.equal(isExplorePreview(video({ href })), true)
})

test("opened posts, Feed, Reels and fullscreen retain normal player clicks", () => {
  for (const options of [
    { dialog: true },
    { fullscreen: true },
    { path: "/" },
    { path: "/p/post/" },
    { path: "/reels/reel/" }
  ])
    assert.equal(isExplorePreview(video(options)), false)
})
