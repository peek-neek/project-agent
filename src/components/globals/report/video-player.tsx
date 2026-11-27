"use client";

import { Player } from "@remotion/player";
import { VIDEO } from "@/lib/video";
import { PropertyVideo } from "@/video/property-video";
import { type PropertyVideoProps, totalFrames } from "@/video/props";

/** The map video, previewed live in the browser (loaded client-only). */
export default function VideoPlayer({ video }: { video: PropertyVideoProps }) {
  return (
    <Player
      component={PropertyVideo}
      inputProps={video}
      durationInFrames={totalFrames(video.scenes)}
      compositionWidth={VIDEO.width}
      compositionHeight={VIDEO.height}
      fps={VIDEO.fps}
      controls
      clickToPlay
      allowFullscreen
      doubleClickToFullscreen
      style={{ width: "100%", height: "100%" }}
    />
  );
}
