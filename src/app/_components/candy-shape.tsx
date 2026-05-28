import { type CSSProperties } from "react";
import { AUDIO_CONFIG, getCandyVariantName, type CandyAudioClass, type CandyModifier } from "@/lib/candy/catalog";

export type CandyShapeKind = "circle" | "spiky" | "pea" | "donut";

const SHAPE_BY_CLASS: Partial<Record<CandyAudioClass, Exclude<CandyShapeKind, "circle">>> = {
  Keyboard_heavy: "spiky",
  Sigh: "pea",
  Mouse_click: "donut",
};

export default function CandyShape({
  audioClass,
  size = 56,
  wrapped = false,
  modifier = "default",
  gradient,
  shape,
}: {
  audioClass: CandyAudioClass;
  size?: number;
  wrapped?: boolean;
  modifier?: CandyModifier;
  gradient?: string;
  shape?: CandyShapeKind;
}) {
  const config = AUDIO_CONFIG[audioClass];
  const label = getCandyVariantName(audioClass, modifier);
  const modClass = modifier !== "default" ? ` candy-mod-${modifier}` : "";
  const resolvedShape = shape ?? SHAPE_BY_CLASS[audioClass];
  const shapeClass = resolvedShape && resolvedShape !== "circle" ? ` candy-shape-${resolvedShape}` : "";

  return (
    <span
      className={`candy-shape ${config.css}${modClass}${shapeClass}`}
      style={
        {
          width: size,
          height: size,
          ...(gradient ? { "--candy-gradient": gradient } : {}),
        } as CSSProperties
      }
      aria-label={label}
    >
      {wrapped ? <span className="wrapped-band" /> : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
