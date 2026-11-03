import {
  getVisibleMediaDialog,
  pauseVideosOutsideDialog,
  isVideoInViewport
} from "@/features/instagram/media/video"
import { isExplorePreview } from "@/features/instagram/media/explore"

import IntervalInjector from "../../player/IntervalInjector"

export default class Feed extends IntervalInjector {
  private mediaDialog: HTMLElement | null = null

  protected override shouldRetainVideo(video: HTMLVideoElement): boolean {
    return (
      !isExplorePreview(video) &&
      (!this.mediaDialog || this.mediaDialog.contains(video))
    )
  }

  protected override shouldInjectVideo(video: HTMLVideoElement): boolean {
    return this.shouldRetainVideo(video) && isVideoInViewport(video)
  }

  public override beforeDelete(): void {
    this.mediaDialog = null
  }

  public override injectMethod(): void {
    // A post can open over Explore while its URL changes to /p/ or /reel/.
    // Use the visible media dialog to keep background tiles out in either URL.
    this.mediaDialog = getVisibleMediaDialog(document)
    pauseVideosOutsideDialog(this.mediaDialog)
    super.injectMethod()
  }
}
