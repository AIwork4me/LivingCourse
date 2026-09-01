import type { CSSProperties } from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { PresentationElement, VideoMotion, VideoPlan, VideoSlidePlan } from "@livingcourse/compiler";

export type LivingCourseVideoProps = {
  plan: VideoPlan;
};

const COLORS = {
  background: "#F7F8F3",
  text: "#1F2A37",
  blue: "#2F6FED",
  orange: "#F28C28",
  line: "#C9D3DF"
} as const;

const geometryStyle = (element: PresentationElement): CSSProperties => ({
  position: "absolute",
  left: `${element.geometry.x * 100}%`,
  top: `${element.geometry.y * 100}%`,
  width: `${element.geometry.width * 100}%`,
  height: `${element.geometry.height * 100}%`
});

const roleStyle = (element: PresentationElement): CSSProperties => {
  const common: CSSProperties = {
    fontFamily: '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
    color: COLORS.text,
    display: "flex",
    alignItems: "center",
    lineHeight: 1.25,
    boxSizing: "border-box"
  };
  if (element.styleRole === "title") return { ...common, fontSize: 48, fontWeight: 700, whiteSpace: "nowrap" };
  if (element.styleRole === "subtitle") return { ...common, fontSize: 30, fontWeight: 700, color: COLORS.blue, whiteSpace: "nowrap" };
  if (element.styleRole === "warning") return { ...common, fontSize: 31, fontWeight: 700, padding: "18px", background: "rgba(242,140,40,0.12)", borderLeft: `6px solid ${COLORS.orange}`, borderRadius: 8 };
  if (element.styleRole === "disclosure") return { ...common, fontSize: 14, fontWeight: 700, color: COLORS.blue, borderTop: `2px solid ${COLORS.line}`, paddingTop: 6 };
  return { ...common, fontSize: 25, fontWeight: 600, justifyContent: "center", textAlign: "center" };
};

const motionFor = (slide: VideoSlidePlan, targetId: string): VideoMotion | undefined =>
  slide.motions.find((motion) => motion.targetIds.includes(targetId));

const motionStyle = (motion: VideoMotion | undefined, frame: number, fps: number): CSSProperties => {
  if (!motion) return {};
  const start = Math.round(motion.atMs * fps / 1000);
  const end = Math.max(start + 1, start + Math.round(motion.durationMs * fps / 1000));
  if (motion.action === "slow_zoom") {
    return { transform: `scale(${interpolate(frame, [start, end], [1, 1.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })})` };
  }
  const opacity = interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [start, end], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return { opacity, transform: `translateY(${translateY}px)` };
};

const Layer: React.FC<{ element: PresentationElement; slide: VideoSlidePlan }> = ({ element, slide }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const base = { ...geometryStyle(element), ...motionStyle(motionFor(slide, element.id), frame, fps) };
  if (element.kind === "image" && element.assetRef) {
    return <div style={{ ...base, overflow: "hidden", transformOrigin: "50% 50%" }}><Img src={staticFile(element.assetRef)} style={{ width: "100%", height: "100%", objectFit: slide.slideId.endsWith("hero") ? "cover" : "contain" }} /></div>;
  }
  if (element.kind === "shape") {
    const color = element.colorRole === "secondary" ? COLORS.orange : element.colorRole === "primary" ? COLORS.blue : COLORS.line;
    if (element.shape === "line") return <div style={{ ...base, background: color }} />;
    return <div style={{ ...base, border: `${element.shape === "circle" ? 4 : 2}px solid ${color}`, borderRadius: element.shape === "circle" ? "50%" : 8, boxSizing: "border-box", boxShadow: element.shape === "circle" ? "0 0 20px rgba(242,140,40,.35)" : undefined }} />;
  }
  return <div style={{ ...base, ...roleStyle(element) }}>{element.text}</div>;
};

const Slide: React.FC<{ slide: VideoSlidePlan; incomingMs: number }> = ({ slide, incomingMs }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const atMs = Math.round(frame * 1000 / fps);
  const activeCaption = slide.captions.find((caption) => atMs >= caption.startMs && atMs < caption.endMs);
  const audioStart = Math.round(slide.audio.startMs * fps / 1000);
  const incomingFrames = Math.round(incomingMs * fps / 1000);
  const slideOpacity = incomingFrames === 0 ? 1 : interpolate(frame, [0, incomingFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const orderedLayers = [...slide.layers].sort((left, right) => Number(left.kind !== "image") - Number(right.kind !== "image") || left.readingOrder - right.readingOrder);
  const captionPlacement: CSSProperties = slide.slideId.includes("safety-focus")
    ? { left: "8%", right: "36%", bottom: "2.5%" }
    : { left: "14%", right: "14%", bottom: "4.5%" };
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background, overflow: "hidden", opacity: slideOpacity }}>
      {orderedLayers.map((element) => <Layer key={element.id} element={element} slide={slide} />)}
      {slide.layers.some((element) => element.styleRole === "title") ? <>
        <div style={{ position: "absolute", left: "6%", top: "5.2%", width: 46, height: 5, background: COLORS.orange }} />
        <div style={{ position: "absolute", left: "10.3%", top: "5.2%", width: 25, height: 5, background: COLORS.blue }} />
      </> : null}
      {slide.audio.assetRef ? <Sequence from={audioStart}><Audio src={staticFile(slide.audio.assetRef)} /></Sequence> : null}
      {activeCaption ? <div style={{ position: "absolute", ...captionPlacement, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: '"Microsoft YaHei", sans-serif', fontSize: 25, lineHeight: 1.28, fontWeight: 700, color: "#000000", background: "transparent", border: "none", textShadow: "0 1px 2px rgba(247,248,243,.98), 0 0 6px rgba(247,248,243,.92)" }}>{activeCaption.text}</div> : null}
    </AbsoluteFill>
  );
};

export const CourseComposition: React.FC<LivingCourseVideoProps> = ({ plan }) => {
  const { fps } = useVideoConfig();
  return <AbsoluteFill>{plan.slides.map((slide, index) => {
    const from = Math.round(slide.globalStartMs * fps / 1000);
    const duration = Math.round(slide.durationMs * fps / 1000);
    const incomingMs = index === 0 ? 0 : plan.slides[index - 1]?.transition.durationMs ?? 0;
    return <Sequence key={slide.slideId} from={from} durationInFrames={duration}><Slide slide={slide} incomingMs={incomingMs} /></Sequence>;
  })}</AbsoluteFill>;
};
