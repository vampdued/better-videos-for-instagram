// Produce a real worker-backed media source without a media download or encoder
// dependency. Used with packaged scripts and the extension's isolated world.
module.exports = async function attachMediaSourceHandle(
  page,
  selector = "video"
) {
  return page.locator(selector).evaluate(async (video) => {
    if (
      typeof MediaSourceHandle === "undefined" ||
      !MediaSource.canConstructInDedicatedWorker
    )
      return { supported: false }

    const mime = "video/webm;codecs=vp8"
    if (!MediaRecorder.isTypeSupported(mime))
      throw new Error("WebM recording unavailable")
    const canvas = document.createElement("canvas")
    canvas.width = 64
    canvas.height = 96
    const drawing = canvas.getContext("2d")
    const stream = canvas.captureStream(20)
    const recorder = new MediaRecorder(stream, { mimeType: mime })
    const chunks = []
    let frame = 0
    const paint = () => {
      drawing.fillStyle = frame++ % 2 ? "#35b" : "#b53"
      drawing.fillRect(0, 0, canvas.width, canvas.height)
    }
    paint()
    const animation = setInterval(paint, 40)
    let stopRecording
    try {
      await new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => chunks.push(event.data)
        recorder.onstop = resolve
        recorder.onerror = () => reject(new Error("Fixture recording failed"))
        recorder.start()
        stopRecording = setTimeout(() => recorder.stop(), 650)
      })
    } finally {
      clearInterval(animation)
      clearTimeout(stopRecording)
      for (const track of stream.getTracks()) track.stop()
    }
    const bytes = await new Blob(chunks, { type: mime }).arrayBuffer()
    video.bigvFixtureDisposeHandle?.()
    video.removeAttribute("src")
    video.srcObject = null
    video.load()
    const url = URL.createObjectURL(
      new Blob(
        [
          `
      onmessage = ({ data }) => {
        const source = new MediaSource();
        source.addEventListener("sourceopen", () => {
          const buffer = source.addSourceBuffer("video/webm;codecs=vp8");
          buffer.addEventListener("updateend", () => source.endOfStream(), { once: true });
          buffer.addEventListener("error", () => postMessage({ error: true }));
          buffer.appendBuffer(data);
        }, { once: true });
        const handle = source.handle;
        postMessage({ handle }, [handle]);
      };
    `
        ],
        { type: "application/javascript" }
      )
    )
    const worker = new Worker(url)
    let handle
    const dispose = () => {
      if (video.srcObject === handle) video.srcObject = null
      worker.terminate()
      URL.revokeObjectURL(url)
    }
    video.bigvFixtureDisposeHandle = dispose
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => finish(new Error("Worker media metadata timed out")),
          7000
        )
        const loaded = () => finish()
        const finish = (error) => {
          clearTimeout(timeout)
          video.removeEventListener("loadedmetadata", loaded)
          if (error) reject(error)
          else resolve()
        }
        video.addEventListener("loadedmetadata", loaded)
        worker.onerror = () => finish(new Error("Media worker failed"))
        worker.onmessage = ({ data }) => {
          if (data.error) return finish(new Error("Worker media append failed"))
          handle = data.handle
          video.srcObject = handle
        }
        worker.postMessage(bytes, [bytes])
      })
    } catch (error) {
      dispose()
      throw error
    }
    URL.revokeObjectURL(url)
    window.addEventListener("pagehide", dispose, { once: true })
    return {
      supported: true,
      isHandle: video.srcObject instanceof MediaSourceHandle,
      src: video.src,
      currentSrc: video.currentSrc
    }
  })
}
