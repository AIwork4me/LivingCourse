import { getVideoMetadata } from "@remotion/renderer";

export interface VideoStructuralQa {
  width: number;
  height: number;
  fps: number;
  durationSeconds: number | null;
  videoCodec: string;
  audioCodec: string | null;
  audioPresent: boolean;
}

export const inspectRenderedVideo = async (videoPath: string): Promise<VideoStructuralQa> => {
  const metadata = await getVideoMetadata(videoPath, { logLevel: "warn" });
  return {
    width: metadata.width,
    height: metadata.height,
    fps: metadata.fps,
    durationSeconds: metadata.durationInSeconds,
    videoCodec: metadata.codec,
    audioCodec: metadata.audioCodec,
    audioPresent: metadata.audioCodec !== null
  };
};
