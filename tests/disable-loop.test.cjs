const assert = require("node:assert/strict")
const test = require("node:test")
const loadSource = require("./load-source.cjs")

function setup(initial = "") {
  const attributes = new Map(initial === null ? [] : [["loop", initial]])
  let observer
  class MutationObserver {
    records = []
    connected = false
    constructor(callback) {
      this.callback = callback
      observer = this
    }
    observe() {
      this.connected = true
    }
    disconnect() {
      this.connected = false
      this.records = []
    }
    takeRecords() {
      return this.records.splice(0)
    }
    flush() {
      const records = this.takeRecords()
      if (records.length) this.callback(records)
    }
  }
  const video = {
    paused: false,
    getAttribute(name) {
      return attributes.get(name) ?? null
    },
    setAttribute(name, next) {
      attributes.set(name, next)
      if (name === "loop" && observer?.connected)
        observer.records.push({ type: "attributes" })
    },
    removeAttribute(name) {
      if (!attributes.delete(name)) return
      if (name === "loop" && observer?.connected)
        observer.records.push({ type: "attributes" })
    }
  }
  const { disableVideoLoop } = loadSource(
    "src/utils/playback/disable-loop.ts",
    { MutationObserver }
  )
  const stop = disableVideoLoop(video)
  return { video, stop, observer }
}

test("disabling loop preserves playback and restores the original attribute on cleanup", () => {
  for (const initial of [null, "", "loop"]) {
    const s = setup(initial)
    assert.equal(s.video.getAttribute("loop"), null)
    assert.equal(s.video.paused, false)
    assert.equal(
      s.observer.records.length,
      0,
      "own writes do not trigger another observer callback"
    )
    s.stop()
    assert.equal(s.video.getAttribute("loop"), initial)
    assert.equal(s.observer.connected, false)
  }
})

test("reused media keeps looping disabled and restores the site's latest loop choice", () => {
  const s = setup(null)
  s.video.setAttribute("loop", "new-source")
  s.observer.flush()
  assert.equal(s.video.getAttribute("loop"), null)
  s.stop()
  assert.equal(s.video.getAttribute("loop"), "new-source")
})

test("site removal and pending writes immediately before cleanup win over the initial snapshot", () => {
  for (const pending of [false, true]) {
    const s = setup("")
    s.video.setAttribute("loop", "replacement")
    s.video.removeAttribute("loop")
    if (!pending) s.observer.flush()
    s.stop()
    assert.equal(s.video.getAttribute("loop"), null)
  }
  const s = setup(null)
  s.video.setAttribute("loop", "pending")
  s.stop()
  assert.equal(s.video.getAttribute("loop"), "pending")
})
