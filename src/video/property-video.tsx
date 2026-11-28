import { loadFont } from "@remotion/google-fonts/Inter";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { ReactElement } from "react";
import { AbsoluteFill, Html5Audio, useVideoConfig } from "remotion";
import { isMapScene, isStatScene } from "../lib/video";
import {
  BRAND_FRAMES,
  type PropertyVideoProps,
  TRANSITION_FRAMES,
  type VideoScene,
} from "./props";
import { BrandScene } from "./scenes/brand-scene";
import { IntroScene } from "./scenes/intro-scene";
import { MapScene } from "./scenes/map-scene";
import { OutroScene } from "./scenes/outro-scene";
import { StatScene } from "./scenes/stat-scene";
import { UpsideScene } from "./scenes/upside-scene";
import { COLORS } from "./theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

/**
 * A 9:16 location tour: the home, then lines to nearby essentials, transit
 * and schools, each with its travel time, under a voiceover and captions.
 */
export function PropertyVideo(props: PropertyVideoProps) {
  const { fps } = useVideoConfig();

  const children: ReactElement[] = [];
  props.scenes.forEach((scene, i) => {
    if (i > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`fade-${i}`}
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />,
      );
    }
    children.push(
      <TransitionSeries.Sequence
        key={`scene-${i}`}
        name={`${i + 1}. ${scene.kind}`}
        durationInFrames={scene.durationInFrames}
        // Maps need a moment to load tiles before they're on screen.
        premountFor={2 * fps}
      >
        <SceneView scene={scene} video={props} />
        {scene.audioSrc && <Html5Audio src={scene.audioSrc} />}
      </TransitionSeries.Sequence>,
    );
  });

  // Every video signs off with whose it is (the agent's on Pro).
  children.push(
    <TransitionSeries.Transition
      key="fade-brand"
      presentation={fade()}
      timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
    />,
    <TransitionSeries.Sequence
      key="brand"
      name="brand"
      durationInFrames={BRAND_FRAMES}
    >
      <BrandScene branding={props.branding} />
    </TransitionSeries.Sequence>,
  );

  return (
    <AbsoluteFill style={{ fontFamily, background: COLORS.paper }}>
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
}

function SceneView({
  scene,
  video,
}: {
  scene: VideoScene;
  video: PropertyVideoProps;
}) {
  if (scene.kind === "intro") {
    return (
      <IntroScene
        scene={scene}
        home={video.home}
        street={video.street}
        locality={video.locality}
      />
    );
  }
  if (scene.kind === "outro") {
    return (
      <OutroScene
        scene={scene}
        street={video.street}
        locality={video.locality}
        facts={video.facts}
      />
    );
  }
  if (isStatScene(scene.kind)) {
    return (
      <StatScene
        scene={scene as VideoScene & { kind: typeof scene.kind }}
        home={video.home}
        stats={video.stats}
      />
    );
  }
  if (scene.kind === "upside") {
    return <UpsideScene scene={scene} home={video.home} stats={video.stats} />;
  }
  if (isMapScene(scene.kind)) {
    return (
      <MapScene
        scene={scene as VideoScene & { kind: typeof scene.kind }}
        home={video.home}
        verb={video.verb}
        destinations={video.destinations}
      />
    );
  }
  return null;
}
