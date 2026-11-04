import IntervalInjector from "../../player/IntervalInjector"
import { isInstagramDirectAudioMessage } from "../media/player-context"
import { isVideoInViewport } from "../media/video"

// Feed already handles these cards on global pages. Reels needs a
// separate owner so music keeps ordinary controls without Reel navigation.
export default class DirectMessages extends IntervalInjector {
  protected override shouldInjectVideo(video: HTMLVideoElement): boolean {
    return isInstagramDirectAudioMessage(video) && isVideoInViewport(video)
  }

  protected override shouldRetainVideo(video: HTMLVideoElement): boolean {
    return isInstagramDirectAudioMessage(video)
  }
}
