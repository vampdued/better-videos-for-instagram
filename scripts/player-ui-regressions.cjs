const assert = require("node:assert/strict")
const path = require("node:path")

async function checkTimelineFocus(page) {
  const slider = page.locator(".progress-bar-horizontal .dragarea").first()
  await slider.click()
  assert.equal(
    await slider.evaluate((el) => getComputedStyle(el).outlineStyle),
    "none",
    "pointer seeking never leaves a focus ring"
  )
  await page.mouse.move(2, 2)
  await page.waitForFunction(() => {
    const baseline = document.querySelector(
      ".progress-bar-horizontal .baseline"
    )
    return (
      baseline.getBoundingClientRect().height <= 3.1 &&
      (baseline.closest(".bigv-pip-player") ||
        getComputedStyle(baseline.querySelector(".progress-handle")).opacity ===
          "0")
    )
  })
  await slider.press("Home")
  assert.equal(
    await slider.evaluate((el) => getComputedStyle(el).outlineStyle),
    "solid",
    "keyboard seeking retains a visible focus indicator"
  )
  await slider.evaluate((el) => el.blur())
  if (await page.locator(".bigv-pip-timeline").count()) {
    const timeline = await page.locator(".bigv-pip-timeline").boundingBox()
    const toolbar = await page.locator(".bigv-player-dock.pip").boundingBox()
    assert.ok(
      timeline.y + timeline.height <= toolbar.y,
      "PiP timeline stays above its toolbar"
    )
  }
}

module.exports = async function playerUiRegressions(
  browser,
  fixture,
  builds,
  output,
  results
) {
  for (const target of builds) {
    {
      const { page, errors } = await fixture(browser, target)
      await page.locator(".fixture-player").hover()
      await page.locator(".bigv-autoskip").click()
      await page.waitForFunction(
        () => localStorage.getItem("bigv-autoskip") === "true"
      )
      await page.evaluate(async () => {
        const reel = document.querySelector(".fixture-player")
        const scroller = document.createElement("div")
        scroller.id = "reel-scroller"
        scroller.style.cssText = "width:360px;height:650px;overflow-y:auto"
        reel.before(scroller)
        scroller.append(reel)
        const next = document.createElement("div")
        next.style.height = "800px"
        scroller.append(next)

        const chat = document.createElement("div")
        chat.id = "floating-chat"
        chat.setAttribute("aria-label", "Fixture chat")
        chat.style.cssText =
          "position:fixed;right:8px;top:20px;width:300px;background:white"
        chat.innerHTML =
          '<div id="chat-history" style="height:390px;overflow-y:auto"><div role="article" aria-roledescription="mesaj"><div><video id="chat-gif" src="https://scontent.cdninstagram.com/gif.mp4" loop muted style="width:200px;height:120px"></video></div></div><div role="article" aria-roledescription="message"><div id="chat-music" style="position:relative;width:245px;height:200px"><video id="chat-audio" src="https://scontent.cdninstagram.com/music.mp4" style="width:100%;height:100%"></video></div></div><div style="height:1200px"></div></div><div contenteditable="true" role="textbox" aria-label="Message"></div><input type="file"><video id="chat-upload" src="blob:fixture-upload" style="width:72px;height:72px"></video>'
        document.body.append(chat)
        for (const video of chat.querySelectorAll("video"))
          window.configureVideo(video)
        Object.defineProperties(chat.querySelector("#chat-audio"), {
          videoWidth: { get: () => 0 },
          videoHeight: { get: () => 0 }
        })
        await chat.querySelector("#chat-gif").play()
      })
      await page.waitForSelector("#chat-music .bigv-dm-audio-play")
      assert.equal(
        await page.locator(".fixture-player [data-bigv-ready]").count(),
        1,
        "a playing GIF cannot replace the paused Reel"
      )
      assert.equal(
        await page
          .locator("#chat-gif[bigv-injected], #chat-upload[bigv-injected]")
          .count(),
        0
      )
      assert.equal(
        await page
          .locator(
            "#floating-chat .bigv-autoskip, #floating-chat .bigv-pip-button, #floating-chat .better-ig-fullscreen-button"
          )
          .count(),
        0
      )
      await page.locator("#chat-music").hover()
      await page.locator("#chat-music .bigv-dm-audio-play").click()
      assert.equal(
        await page.locator("#chat-audio").evaluate((video) => video.paused),
        false
      )
      await page.evaluate(() => {
        for (const id of ["chat-gif", "chat-audio"]) {
          const video = document.getElementById(id)
          for (const time of [9.85, 9.9, 9.96, 10]) {
            video.currentTime = time
            video.dispatchEvent(new Event("timeupdate"))
          }
          video.dispatchEvent(new Event("ended"))
        }
      })
      await page.waitForTimeout(350)
      assert.equal(
        await page.locator("#chat-history").evaluate((node) => node.scrollTop),
        0,
        "DM completion cannot scroll chat history"
      )
      assert.equal(
        await page.locator("#reel-scroller").evaluate((node) => node.scrollTop),
        0,
        "DM completion cannot advance the Reel"
      )
      assert.equal(
        await page.locator(".fixture-player [data-bigv-ready]").count(),
        1
      )
      await page.evaluate(async () => {
        const reel = document.querySelector(".fixture-player video")
        reel.loop = true
        await reel.play()
        for (const time of [9.85, 9.9, 9.96]) {
          reel.currentTime = time
          reel.dispatchEvent(new Event("timeupdate"))
        }
      })
      await page.waitForFunction(
        () => document.querySelector("#reel-scroller").scrollTop === 650
      )
      assert.equal(
        await page.locator("#chat-history").evaluate((node) => node.scrollTop),
        0
      )
      await page.evaluate(() => {
        document.querySelector("#reel-scroller").scrollTop = 0
        history.pushState({}, "", "/")
      })
      await page.waitForFunction(
        async () => (await window.diagnose()).page === "global"
      )
      await page.waitForSelector("#chat-music .bigv-dm-audio-play")
      assert.equal(
        await page.locator("#chat-music [data-bigv-controller]").count(),
        1,
        "Feed takes ownership without duplicate music controls"
      )
      assert.equal(
        await page
          .locator("#chat-gif[bigv-injected], #chat-upload[bigv-injected]")
          .count(),
        0
      )
      await page.evaluate(() =>
        document.querySelector("#floating-chat").remove()
      )
      await page.waitForFunction(
        async () => (await window.diagnose()).controllers === 1
      )
      assert.deepEqual(errors, [])
      results.push(
        `${target}/floating-direct: playing GIFs and uploads stay native on Reels and Feed; music keeps ordinary controls; auto-skip advances only the Reel without scrolling chat`
      )
      await page.close()
    }
    {
      const { page, errors } = await fixture(browser, target, {
        route: "/",
        clickMode: "pause"
      })
      await page.locator("video").evaluate((video) => {
        video.controls = true
      })
      await page.waitForSelector("[data-bigv-controller]", {
        state: "detached"
      })
      assert.equal(
        await page.locator("video").evaluate((video) => video.controls),
        true
      )
      assert.equal(await page.locator("#native-audio").isVisible(), true)
      await page.locator("video").evaluate((video) => {
        video.controls = false
      })
      await page.waitForSelector("[data-bigv-ready]")
      await page.evaluate(() => history.pushState({}, "", "/direct/t/fixture/"))
      await page.waitForSelector("[data-bigv-controller]", {
        state: "detached"
      })
      await page.evaluate(() => {
        const original = document.querySelector("video")
        original.id = "dm-viewer-video"
        original.controls = true
        original.parentElement.setAttribute("role", "dialog")
        const composer = document.createElement("form")
        composer.id = "dm-composer"
        composer.style.cssText =
          "position:fixed;left:8px;bottom:8px;background:white"
        composer.innerHTML =
          '<video id="dm-attachment" src="blob:fixture-upload" style="width:72px;height:72px"></video><button type="button" id="remove-attachment" aria-label="Remove attachment">×</button><div role="textbox" contenteditable="true" aria-label="Message"></div><input type="file" accept="video/*">'
        composer.querySelector("button").onclick = () =>
          document.querySelector("#dm-attachment").remove()
        const messages = document.createElement("div")
        messages.setAttribute("role", "log")
        messages.innerHTML =
          '<video id="dm-gif" loop autoplay muted src="https://scontent.cdninstagram.com/gif.mp4" style="position:fixed;right:0;top:30px;width:120px;height:120px"></video>'
        for (const video of [
          ...composer.querySelectorAll("video"),
          ...messages.querySelectorAll("video")
        ])
          window.configureVideo(video)
        document.body.append(composer, messages)
      })
      await page.waitForFunction(async () => {
        const state = await window.diagnose()
        return state.supportedVideos === 3 && state.controllers === 0
      })
      await page.locator("#dm-gif").evaluate((video) => video.play())
      await page.evaluate(() => {
        const music = document.createElement("div")
        music.id = "dm-music"
        music.setAttribute("role", "article")
        music.style.cssText =
          "position:fixed;right:150px;top:220px;width:245px;height:240px;background:#3b7f92"
        music.innerHTML =
          '<video id="dm-music-video" src="https://scontent.cdninstagram.com/music.mp4" style="width:100%;height:100%"></video><button type="button" id="native-music-play" style="position:absolute;inset:0;background:transparent;border:0;color:white"><span>Music preview</span></button>'
        const audio = music.querySelector("video")
        window.configureVideo(audio)
        Object.defineProperties(audio, {
          videoWidth: { get: () => 0 },
          videoHeight: { get: () => 0 }
        })
        window.nativeMusicClicks = 0
        music.querySelector("button").onclick = () => {
          window.nativeMusicClicks++
          if (audio.paused) void audio.play()
          else audio.pause()
        }
        document.body.append(music)
      })
      await page.waitForSelector("#dm-music [data-bigv-ready]")
      await page.locator("#dm-attachment").click()
      assert.equal(
        await page.locator("#dm-attachment").evaluate((video) => video.paused),
        true
      )
      await page.locator('#dm-composer [role="textbox"]').fill("A message")
      await page.keyboard.press("k")
      assert.equal(
        await page.locator('#dm-composer [role="textbox"]').innerText(),
        "A messagek"
      )
      await page.locator("#remove-attachment").click()
      assert.equal(await page.locator("#dm-attachment").count(), 0)
      assert.equal(await page.locator("[data-bigv-controller]").count(), 1)
      assert.equal(
        await page
          .locator("#dm-gif[bigv-injected],#dm-viewer-video[bigv-injected]")
          .count(),
        0
      )
      assert.equal(
        await page.locator("#dm-gif").evaluate((video) => video.paused),
        false
      )
      await page.locator("#dm-music").hover()
      await page.locator("#dm-music .bigv-dm-audio-play").click()
      assert.equal(
        await page.locator("#dm-music-video").evaluate((video) => video.paused),
        false
      )
      await page.locator("#dm-music .bigv-dm-audio-play").click()
      assert.equal(
        await page.locator("#dm-music-video").evaluate((video) => video.paused),
        true
      )
      await page.locator("#dm-music .better-ig-volume-button").hover()
      const musicVolume = page.locator(
        '#dm-music .better-ig-progress-bar-vertical [role="slider"]'
      )
      await musicVolume.waitFor({ state: "visible" })
      await musicVolume.press("Home")
      await page.waitForFunction(
        () => document.querySelector("#dm-music-video").volume === 0
      )
      await musicVolume.press("ArrowUp")
      await page.waitForFunction(
        () =>
          Math.abs(document.querySelector("#dm-music-video").volume - 0.05) <
          0.001
      )
      const musicTimeline = page.locator(
        '#dm-music .progress-bar-horizontal [role="slider"]'
      )
      await musicTimeline.press("ArrowRight")
      assert.equal(
        await page
          .locator("#dm-music-video")
          .evaluate((video) => video.currentTime > 0),
        true
      )
      await page
        .locator("#native-music-play")
        .click({ position: { x: 50, y: 50 } })
      assert.equal(await page.evaluate(() => window.nativeMusicClicks), 1)
      assert.equal(
        await page.locator("#dm-music-video").evaluate((video) => video.paused),
        false
      )
      assert.equal(
        await page
          .locator(
            "#dm-music .bigv-pip-button, #dm-music .better-ig-fullscreen-button"
          )
          .count(),
        0
      )
      await page.screenshot({
        path: path.join(output, `${target}-dm-music-controls.png`)
      })
      await page.evaluate(() => {
        document.querySelector("#dm-music").remove()
        document.querySelector("#dm-composer").remove()
        document.querySelector('[role="log"]').remove()
        document.querySelector("#dm-viewer-video").controls = false
        document.querySelector(".fixture-player").removeAttribute("role")
        history.pushState({}, "", "/")
      })
      await page.waitForSelector("[data-bigv-ready]")
      assert.equal(await page.locator("[data-bigv-controller]").count(), 1)
      assert.deepEqual(errors, [])
      results.push(
        `${target}/direct: audio-only music messages retain volume, play/pause and seeking; composer uploads, GIFs and the native viewer remain untouched, and Feed controls recover on return`
      )
      await page.close()
    }
    for (const route of ["/", "/reels/fixture/", "/p/fixture/"]) {
      const { page, errors, handleSource } = await fixture(browser, target, {
        route,
        mediaSourceHandle: true
      })
      if (!handleSource.supported) {
        results.push(
          `${target}${route}: worker MediaSourceHandle unavailable in this browser`
        )
        await page.close()
        continue
      }
      assert.equal(handleSource.isHandle, true)
      assert.equal(handleSource.src, "")
      assert.equal(handleSource.currentSrc, "")
      const diagnostic = await page.evaluate(() => window.diagnose())
      assert.equal(diagnostic.supportedVideos, 1)
      assert.equal(diagnostic.controllers, 1)
      assert.deepEqual(diagnostic.sources, {
        blob: 0,
        https: 0,
        mediaSourceHandle: 1
      })
      await page.locator("video").hover()
      await page.keyboard.press("k")
      assert.equal(
        await page.locator("video").evaluate((video) => video.paused),
        false
      )
      await page.keyboard.press("k")
      assert.equal(
        await page.locator("video").evaluate((video) => video.paused),
        true
      )
      assert.deepEqual(errors, [])
      results.push(
        `${target}${route}: URL-less worker MediaSourceHandle is injected, selected, controlled and counted in diagnostics`
      )
      await page.close()
    }
    for (const mode of ["native", "pause", "pause-reels"]) {
      const { page, errors } = await fixture(browser, target, {
        route: "/explore/",
        linked: true,
        clickMode: mode,
        expectControls: false
      })
      assert.equal(await page.locator("[data-bigv-controller]").count(), 0)
      assert.equal(await page.locator("video[bigv-injected]").count(), 0)
      await page.locator("#native-link").evaluate((link) => {
        link.addEventListener("click", (event) => event.preventDefault())
      })
      for (const href of ["/reel/destination/", "/p/destination/"]) {
        await page.locator("#native-link").evaluate((link, href) => {
          link.href = href
        }, href)
        await page.locator("video").click({ position: { x: 180, y: 280 } })
        assert.equal(
          await page.locator("video").evaluate((v) => v.paused),
          true
        )
      }
      assert.equal(await page.evaluate(() => window.nativeReelClicks), 2)
      // A post opened over Explore is a full player, even if the URL stays put.
      await page.locator(".fixture-player").evaluate((player) => {
        player.setAttribute("role", "dialog")
      })
      await page.waitForSelector("[data-bigv-ready]")
      await page.locator("video").click({ position: { x: 180, y: 280 } })
      assert.equal(
        await page.locator("video").evaluate((v) => v.paused),
        mode === "native"
      )
      await page.locator(".fixture-player").evaluate((player) => {
        player.removeAttribute("role")
        history.pushState({}, "", "/")
        player.querySelector("video").pause()
      })
      await page.waitForSelector("[data-bigv-ready]")
      await page.locator("video").click({ position: { x: 180, y: 280 } })
      assert.equal(
        await page.locator("video").evaluate((v) => v.paused),
        mode === "native",
        "reused Feed nodes retain the selected click mode"
      )
      assert.deepEqual(errors, [])
      results.push(
        `${target}/explore/${mode}: previews have no controls and open natively; dialog and reused Feed players keep their click mode`
      )
      await page.close()
    }
    for (const openedRoute of ["/p/opened/", "/reel/opened/"]) {
      const { page, errors } = await fixture(browser, target, {
        route: "/",
        linked: true,
        clickMode: "pause"
      })
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-background-playback": true })
      )
      await page.locator("video").evaluate(async (video) => {
        await video.play()
        history.pushState({}, "", "/explore/")
      })
      await page.waitForSelector("[data-bigv-controller]", {
        state: "detached"
      })
      await page.locator("#native-link").evaluate((link, openedRoute) => {
        link.addEventListener("click", (event) => {
          event.preventDefault()
          const dialog = document.createElement("div")
          dialog.id = "opened-post"
          dialog.setAttribute("role", "dialog")
          dialog.tabIndex = -1
          dialog.style.cssText =
            "position:fixed;inset:0;z-index:20;background:#222"
          const player = document.createElement("article")
          player.style.cssText = "position:relative;width:360px;height:600px"
          const video = document.createElement("video")
          video.src = "https://scontent.cdninstagram.com/opened.mp4"
          video.style.cssText = "width:100%;height:100%"
          window.configureVideo(video)
          player.append(video)
          dialog.append(player)
          document.body.append(dialog)
          dialog.focus()
          history.pushState({}, "", openedRoute)
          void video.play()
        })
      }, openedRoute)
      await page
        .locator("#native-link video")
        .click({ position: { x: 180, y: 280 } })
      await page.waitForSelector("#opened-post [data-bigv-ready]")
      await page.waitForFunction(
        () => document.querySelector("#native-link video").paused
      )
      assert.equal(
        await page.locator("#native-link [data-bigv-controller]").count(),
        0
      )
      assert.equal(
        await page.locator("#opened-post video").evaluate((v) => v.paused),
        false
      )
      // A late native autoplay must not bring the obscured preview back.
      await page.locator("#native-link video").evaluate((v) => v.play())
      await page.waitForFunction(
        () => document.querySelector("#native-link video").paused
      )
      await page
        .locator("#opened-post video")
        .hover({ position: { x: 180, y: 280 } })
      await page.keyboard.press("k")
      assert.equal(
        await page.locator("#opened-post video").evaluate((v) => v.paused),
        true
      )
      await page.evaluate(() => {
        document.querySelector("#opened-post").remove()
        history.pushState({}, "", "/explore/")
      })
      await page.waitForFunction(
        async () => (await window.diagnose()).controllers === 0
      )
      assert.equal(
        await page.locator("#native-link video").evaluate((v) => v.paused),
        true
      )
      await page.waitForSelector("[data-bigv-controller]", {
        state: "detached"
      })
      assert.equal(await page.locator("[data-bigv-controller]").count(), 0)
      assert.deepEqual(errors, [])
      results.push(
        `${target}/explore/modal${openedRoute}: old controls removed, background playback stopped across URL changes and late autoplay; only the opened video is controlled`
      )
      await page.close()
    }
    {
      const { page, errors } = await fixture(browser, target, { route: "/" })
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-background-playback": true })
      )
      assert.equal(
        await page.locator("video").evaluate((video) => video.paused),
        true
      )
      await page.locator("video").evaluate((video) => video.play())
      await page.waitForSelector('video[data-bigv-background-playing="true"]', {
        state: "attached"
      })
      await page.evaluate(() => {
        const player = document.createElement("article")
        player.id = "other-feed"
        player.style.cssText =
          "position:fixed;right:0;top:20px;width:200px;height:300px"
        const video = document.createElement("video")
        video.style.cssText = "width:100%;height:100%"
        video.src = "https://scontent.cdninstagram.com/other.mp4"
        window.configureVideo(video)
        player.append(video)
        document.body.append(player)
      })
      await page.waitForSelector("#other-feed [data-bigv-ready]")
      await page
        .locator("#other-feed video")
        .click({ position: { x: 70, y: 100 } })
      await page.waitForSelector(
        '#other-feed video[data-bigv-background-playing="true"]',
        { state: "attached" }
      )
      assert.equal(
        await page
          .locator('video[data-bigv-background-playing="true"]')
          .count(),
        1
      )
      await page.keyboard.press("k")
      await page.waitForSelector("video[data-bigv-background-playing]", {
        state: "detached"
      })
      assert.equal(
        await page
          .locator("#other-feed video")
          .evaluate((video) => video.paused),
        true
      )
      await page.keyboard.press("k")
      await page.waitForSelector(
        '#other-feed video[data-bigv-background-playing="true"]',
        { state: "attached" }
      )
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-controller-enabled": false })
      )
      await page.waitForSelector("video[data-bigv-background-playing]", {
        state: "detached"
      })
      assert.deepEqual(errors, [])
      results.push(
        `${target}/background: no autoplay on enable, only the selected Feed source is protected, explicit pause and extension disable clear protection`
      )
      await page.close()
    }
    for (const route of ["/", "/reels/fixture/"]) {
      const { page, errors } = await fixture(browser, target, { route })
      await page.locator("video").evaluate((video) => {
        video.loop = true
      })
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-disable-loop-videos": true })
      )
      await page.waitForFunction(() => !document.querySelector("video").loop)
      await page.locator("video").evaluate((video) => {
        video.loop = true
        video.src = "https://scontent.cdninstagram.com/reused.mp4"
        video.dispatchEvent(new Event("loadedmetadata"))
      })
      await page.waitForFunction(() => !document.querySelector("video").loop)
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-disable-loop-videos": false })
      )
      await page.waitForFunction(() => document.querySelector("video").loop)
      assert.equal(await page.locator("video").evaluate((v) => v.paused), true)
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-disable-loop-videos": true })
      )
      await page.waitForFunction(() => !document.querySelector("video").loop)
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-controller-enabled": false })
      )
      await page.waitForSelector("[data-bigv-controller]", {
        state: "detached"
      })
      assert.equal(await page.locator("video").evaluate((v) => v.loop), true)
      assert.deepEqual(errors, [])
      results.push(
        `${target}${route}: loop switch applies live, survives reused media, restores on disable without playback`
      )
      await page.close()
    }
    for (const mode of ["native", "pause", "pause-reels"]) {
      const { page, errors } = await fixture(browser, target, {
        route: "/",
        linked: true,
        clickMode: mode
      })
      if (mode === "native") await checkTimelineFocus(page)
      await page.locator("video").evaluate((video) => video.play())
      await page.locator("video").hover()
      await page.locator(".better-ig-fullscreen-button").click()
      await page.waitForFunction(
        () =>
          document.fullscreenElement &&
          !document.querySelector("#native-link").hasAttribute("href")
      )
      assert.equal(
        await page
          .locator("video")
          .evaluate((video) => getComputedStyle(video).cursor),
        "default"
      )
      assert.equal(await page.locator(".bigv-open-reel-button").count(), 0)
      await page.locator("video").click({ position: { x: 180, y: 280 } })
      assert.equal(await page.locator("video").evaluate((v) => v.paused), true)
      await page.locator("video").click({ position: { x: 180, y: 280 } })
      assert.equal(await page.locator("video").evaluate((v) => v.paused), false)
      assert.equal(new URL(page.url()).pathname, "/")
      assert.equal(await page.evaluate(() => window.nativeReelClicks), 0)
      await page
        .locator("#native-link")
        .evaluate((el) => el.setAttribute("href", "/reel/new-current/"))
      await page.waitForFunction(
        () => !document.querySelector("#native-link").hasAttribute("href")
      )
      await page.evaluate(() => document.exitFullscreen())
      await page.waitForFunction(
        () =>
          !document.fullscreenElement &&
          document.querySelector("#native-link").getAttribute("href") ===
            "/reel/new-current/"
      )
      assert.equal(
        await page.locator("#native-link").getAttribute("href"),
        "/reel/new-current/"
      )
      assert.deepEqual(errors, [])
      results.push(
        `${target}/fullscreen/${mode}: href/status and link cursor suppressed, native navigation blocked, pause/play works, updated destination restored on exit`
      )
      await page.close()
    }
    {
      const { page, errors } = await fixture(browser, target, {
        route: "/",
        clickMode: "pause-reels"
      })
      assert.equal(await page.locator(".bigv-open-reel-button").count(), 0)
      await page.locator(".fixture-player").evaluate((player) => {
        const link = document.createElement("a")
        link.id = "dynamic-reel"
        link.href = "/reel/available/"
        link.textContent = "Open current Reel"
        player.append(link)
      })
      await page.waitForSelector(".bigv-open-reel-button", {
        state: "attached"
      })
      await page
        .locator("#dynamic-reel")
        .evaluate((el) => el.removeAttribute("href"))
      await page.waitForSelector(".bigv-open-reel-button", {
        state: "detached"
      })
      await page.locator("video").click({ position: { x: 160, y: 200 } })
      const mute = page.locator(".fixture-player .better-ig-volume-button")
      await mute.hover()
      await mute.click()
      await page.waitForFunction(() => document.querySelector("video").muted)
      await mute.click()
      await page.waitForFunction(() => !document.querySelector("video").muted)
      await page.evaluate(() => {
        // The site's automatic mute must not become the shared user preference.
        document.querySelector("video").muted = true
        const article = document.createElement("article")
        article.id = "next-feed"
        article.style.cssText =
          "position:fixed;right:0;top:20px;width:260px;height:440px"
        const video = document.createElement("video")
        video.style.cssText = "width:100%;height:100%"
        video.src = "https://scontent.cdninstagram.com/next.mp4"
        video.muted = true
        window.configureVideo(video)
        article.append(video)
        document.body.append(article)
      })
      await page.waitForSelector("#next-feed [data-bigv-ready]")
      await page.waitForFunction(() =>
        [...document.querySelectorAll("video")].every((v) => !v.muted)
      )
      assert.equal(
        await page.evaluate(() =>
          localStorage.getItem("better-instagram-videos-muted")
        ),
        "false"
      )
      assert.equal(
        await page.locator("#native-audio").isVisible(),
        false,
        "Feed native audio is hidden too"
      )
      assert.deepEqual(errors, [])
      results.push(
        `${target}/feed: no empty Reels action, dynamic target updates, shared audio survives automatic mute and new injection; native Feed volume hidden`
      )
      await page.close()
    }
    {
      const { page, errors } = await fixture(browser, target, { width: 390 })
      await checkTimelineFocus(page)
      const nativeVolume = require("node:fs").readFileSync(
        path.resolve(
          __dirname,
          "../tests/fixtures/instagram-native-volume.html"
        ),
        "utf8"
      )
      const previousController = await page
        .locator("[data-bigv-controller]")
        .getAttribute("id")
      await page.locator(".fixture-player").evaluate((player, html) => {
        const video = player.querySelector("video")
        let parent = video
        for (let i = 0; i < 8; i++) {
          const wrapper = document.createElement("div")
          wrapper.style.cssText = "width:100%;height:100%"
          parent.replaceWith(wrapper)
          wrapper.append(parent)
          parent = wrapper
        }
        player.insertAdjacentHTML("beforeend", html)
      }, nativeVolume)
      await page.waitForFunction(
        (oldId) => document.querySelector("[data-bigv-ready]")?.id !== oldId,
        previousController
      )
      await page.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector("[data-fixture-native-volume]")
          ).display === "none"
      )
      await page.locator("[data-fixture-native-volume]").evaluate((volume) => {
        const overlay = document.createElement("div")
        overlay.id = "responsive-reel-overlay"
        overlay.setAttribute("role", "button")
        overlay.style.cssText = "position:absolute;inset:0;pointer-events:none"
        volume.replaceWith(overlay)
        overlay.append(volume)
        const metadata = document.createElement("div")
        metadata.id = "reel-metadata"
        metadata.style.cssText =
          "position:absolute;left:12px;bottom:80px;color:white;pointer-events:auto"
        metadata.innerHTML =
          '<a id="reel-account" href="/fixture-profile/" style="color:white">example_account</a><p id="reel-caption">A Reel caption</p><a href="/reels/audio/fixture/" style="color:white">Original audio</a>'
        overlay.append(metadata)
        window.nativeMetadataClicks = 0
        metadata.querySelector("a").addEventListener("click", (event) => {
          event.preventDefault()
          window.nativeMetadataClicks++
        })
      })
      await page.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector("[data-fixture-native-volume]")
          ).display === "none"
      )
      for (const width of [1200, 390]) {
        await page.setViewportSize({ width, height: 850 })
        assert.equal(await page.locator("#reel-account").isVisible(), true)
        assert.equal(await page.locator("#reel-caption").isVisible(), true)
        await page.locator("#reel-account").click()
      }
      assert.equal(await page.evaluate(() => window.nativeMetadataClicks), 2)
      await page.screenshot({
        path: path.join(output, `${target}-reels-responsive-metadata.png`)
      })
      await page.locator("[data-fixture-native-volume]").evaluate((root) => {
        for (const node of root.querySelectorAll("[aria-label]"))
          node.setAttribute("aria-label", "音声")
        root.querySelector("title").textContent = "音声"
      })
      assert.equal(
        await page
          .locator("[data-fixture-native-volume]")
          .evaluate((el) => getComputedStyle(el).display),
        "none",
        "observed speaker icon still identifies localized controls"
      )
      await page.locator("[data-fixture-native-volume]").evaluate((root) => {
        root.querySelector("path").setAttribute("d", "M0 0h1")
      })
      await page.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector("[data-fixture-native-volume]")
          ).display !== "none"
      )
      await page
        .locator("[data-fixture-native-volume]")
        .evaluate((root, html) => (root.outerHTML = html), nativeVolume)
      await page.waitForFunction(
        () =>
          getComputedStyle(
            document.querySelector("[data-fixture-native-volume]")
          ).display === "none"
      )
      assert.equal(
        await page
          .locator("#native-audio")
          .evaluate((el) => getComputedStyle(el).visibility),
        "hidden"
      )
      assert.equal(
        await page
          .locator("#tags")
          .evaluate((el) => getComputedStyle(el).visibility),
        "visible"
      )
      const dock = page.locator(".bigv-player-dock.reels")
      assert.equal(
        await dock.evaluate((el) => el.classList.contains("is-persistent")),
        false
      )
      await page.waitForFunction(
        () =>
          Number(
            getComputedStyle(document.querySelector(".bigv-player-dock.reels"))
              .opacity
          ) <= 0.01
      )
      await page.locator("video").hover()
      await page.waitForFunction(
        () =>
          Number(
            getComputedStyle(document.querySelector(".bigv-player-dock.reels"))
              .opacity
          ) >= 0.99
      )
      assert.equal(
        await dock.evaluate((el) => getComputedStyle(el).transform),
        "none"
      )
      await page.mouse.move(2, 800)
      await page.waitForFunction(
        () =>
          Number(
            getComputedStyle(document.querySelector(".bigv-player-dock.reels"))
              .opacity
          ) <= 0.01
      )
      await page.locator("video").hover()
      await page.locator(".better-ig-volume-button").hover()
      const popup = page.locator(".better-ig-progress-bar-vertical")
      await popup.waitFor({ state: "visible" })
      const drawer = await popup.boundingBox()
      const button = await page
        .locator(".better-ig-volume-button")
        .boundingBox()
      assert.ok(
        drawer.y + drawer.height < button.y,
        "volume drawer clears the control row"
      )
      assert.equal(Math.round(drawer.width), 32)
      await page.evaluate(() => {
        window.volumeStateAtDockHide = null
        const dock = document.querySelector(".bigv-player-dock.reels")
        new MutationObserver(() => {
          if (!dock.classList.contains("is-visible"))
            window.volumeStateAtDockHide = getComputedStyle(
              dock.querySelector(".better-ig-progress-bar-vertical")
            ).visibility
        }).observe(dock, { attributes: true, attributeFilter: ["class"] })
      })
      await page.mouse.move(2, 800)
      await page.waitForFunction(() => window.volumeStateAtDockHide !== null)
      assert.equal(
        await page.evaluate(() => window.volumeStateAtDockHide),
        "hidden",
        "volume finishes closing before the whole dock starts fading"
      )
      await page.locator("video").hover()
      await page.locator(".better-ig-volume-button").hover()
      await popup.waitFor({ state: "visible" })
      await page.locator("video").evaluate((video) => {
        video.currentTime = video.duration
        video.dispatchEvent(new Event("timeupdate"))
      })
      assert.equal(
        await page
          .locator(".progress-track")
          .evaluate((el) => getComputedStyle(el).overflow),
        "hidden"
      )
      await page.screenshot({
        path: path.join(output, `${target}-reels-volume-full-progress.png`)
      })
      await page.locator(".bigv-speed-button").click()
      assert.equal(
        await popup.evaluate((el) => getComputedStyle(el).visibility),
        "hidden",
        "speed and volume drawers never overlap"
      )
      await page.locator(".bigv-speed-option").first().click()
      await page.evaluate(() =>
        chrome.storage.sync.set({ "bigv-controller-enabled": "false" })
      )
      await page.waitForSelector("[data-bigv-controller]", {
        state: "detached"
      })
      assert.equal(
        await page
          .locator("#native-audio")
          .evaluate((el) => getComputedStyle(el).visibility),
        "visible"
      )
      assert.deepEqual(errors, [])
      results.push(
        `${target}/reels: rounded filled timeline, separated volume drawer, compact autoskip, native audio hidden and restored on disable`
      )
      await page.close()
    }
    {
      const { page, errors } = await fixture(browser, target, {
        documentPip: true
      })
      await page.locator("video").click({ position: { x: 150, y: 220 } })
      await page.locator("video").evaluate((video) => video.play())
      const popupEvent = page.waitForEvent("popup")
      await page.locator(".bigv-pip-button").click()
      const pip = await popupEvent
      await pip.waitForSelector(".bigv-pip-player.is-visible")
      await checkTimelineFocus(pip)
      await pip.evaluate(() => {
        window.originalPanel = document.querySelector(".bigv-pip-player")
      })
      await pip.mouse.move(2, 2)
      await pip.waitForFunction(
        () =>
          !document
            .querySelector(".bigv-pip-player")
            .classList.contains("is-visible")
      )
      await pip.waitForFunction(
        () =>
          Number(
            getComputedStyle(document.querySelector(".bigv-pip-player")).opacity
          ) <= 0.01
      )
      await page.evaluate(() => {
        const old = document.querySelector(".fixture-player video")
        const next = document.createElement("video")
        next.src = "https://scontent.cdninstagram.com/handoff.mp4"
        window.configureVideo(next)
        next.currentTime = 3
        old.replaceWith(next)
      })
      await pip.waitForFunction(
        () => document.querySelector(".bigv-pip-time")?.textContent === "0:03"
      )
      await page.waitForFunction(() => {
        const dock = document.querySelector(".bigv-player-dock.reels")
        return (
          dock &&
          !dock.classList.contains("is-persistent") &&
          !dock.classList.contains("is-visible")
        )
      })
      assert.equal(
        await pip.evaluate(
          () =>
            document.querySelector(".bigv-pip-player") === window.originalPanel
        ),
        true
      )
      assert.equal(
        await pip.evaluate(() =>
          document
            .querySelector(".bigv-pip-player")
            .classList.contains("is-visible")
        ),
        false,
        "handoff does not reveal controls"
      )
      await page.locator("video").evaluate((video) => {
        video.dispatchEvent(new Event("play"))
        video.dispatchEvent(new Event("pause"))
        video.dispatchEvent(new Event("ended"))
      })
      assert.equal(
        await pip.evaluate(() =>
          document
            .querySelector(".bigv-pip-player")
            .classList.contains("is-visible")
        ),
        false,
        "media events do not reveal controls"
      )
      await pip.mouse.move(150, 200)
      await pip.waitForSelector(".bigv-pip-player.is-visible")
      await pip.waitForFunction(
        () =>
          Number(
            getComputedStyle(document.querySelector(".bigv-pip-player")).opacity
          ) >= 0.99
      )
      await pip.screenshot({
        path: path.join(output, `${target}-pip-handoff.png`)
      })
      await pip.close()
      assert.deepEqual(errors, [])
      results.push(
        `${target}/pip: panel identity and hidden state survive Reel handoff and media events; intentional pointer movement reveals controls`
      )
      await page.close()
    }
  }
}
