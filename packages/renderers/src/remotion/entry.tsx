import React from "react";
import { Composition, registerRoot } from "remotion";
import { z } from "zod";
import { CourseComposition } from "./composition.tsx";
import type { VideoPlan } from "@livingcourse/compiler";

const placeholder: VideoPlan = {
  version: "0.1.0",
  courseId: "placeholder",
  title: "placeholder",
  width: 1280,
  height: 720,
  fps: 30,
  durationMs: 1000,
  durationFrames: 30,
  captionStyle: { color: "#000000", background: "transparent", border: "none", maxLines: 2 },
  slides: [],
  contentHash: "placeholder"
};

const schema = z.object({ plan: z.custom<VideoPlan>() });

const Root: React.FC = () => <Composition
  id="LivingCourseVideo"
  schema={schema}
  component={CourseComposition}
  durationInFrames={placeholder.durationFrames}
  fps={placeholder.fps}
  width={placeholder.width}
  height={placeholder.height}
  defaultProps={{ plan: placeholder }}
  calculateMetadata={({ props }) => ({
    durationInFrames: props.plan.durationFrames,
    fps: props.plan.fps,
    width: props.plan.width,
    height: props.plan.height
  })}
/>;

registerRoot(Root);
