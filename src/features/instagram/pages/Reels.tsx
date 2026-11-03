import { pictureInPicture } from "@/utils/pip/controller"
import {
  getActiveInstagramVideo,
  getVisibleMediaDialog,
  pauseVideosOutsideDialog
} from "@/features/instagram/media/video"

import { Variant } from "../../player/Injector"
import IntervalInjector, {
  type IntervalInjectorOptions
} from "../../player/IntervalInjector"

export default class Reels extends IntervalInjector {
  private activeVideo: HTMLVideoElement | null = null
  private mediaDialog: HTMLElement | null = null
  constructor(options?: IntervalInjectorOptions) {
    super({ ...options, variant: Variant.Reels })
  }
  protected override shouldInjectVideo(video: HTMLVideoElement): boolean {
    return this.activeVideo === video
  }
  protected override shouldRetainVideo(video: HTMLVideoElement): boolean {
    return !this.mediaDialog || this.mediaDialog.contains(video)
  }
  public override injectMethod(): void {
    const previous = this.activeVideo
    this.mediaDialog = getVisibleMediaDialog(document)
    pauseVideosOutsideDialog(this.mediaDialog)
    this.activeVideo = getActiveInstagramVideo()
    pictureInPicture.follow(this.activeVideo)
    super.injectMethod()
    if (this.activeVideo !== previous)
      for (const video of [previous, this.activeVideo])
        video?.dispatchEvent(new Event("bigv-activechange"))
  }
  public override beforeDelete(): void {
    pictureInPicture.stopFollowing()
    this.activeVideo = null
    this.mediaDialog = null
  }
}
