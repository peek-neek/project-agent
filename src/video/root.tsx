import { Composition } from "remotion";
import { VIDEO } from "../lib/video";
import { PropertyVideo } from "./property-video";
import { type PropertyVideoProps, totalFrames } from "./props";
import { sampleVideoProps } from "./sample";

// Remotion Studio and CLI entry (see index.ts). The app's Player imports
// PropertyVideo directly; renders pass a report's props with --props.
export function RemotionRoot() {
  return (
    <Composition
      id="PropertyVideo"
      component={PropertyVideo}
      width={VIDEO.width}
      height={VIDEO.height}
      fps={VIDEO.fps}
      durationInFrames={totalFrames(sampleVideoProps.scenes)}
      defaultProps={sampleVideoProps satisfies PropertyVideoProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalFrames(props.scenes),
      })}
    />
  );
}
