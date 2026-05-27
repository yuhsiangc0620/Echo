import { AUDIO_CONFIG, getCandyVariantName, type CandyAudioClass, type CandyModifier } from "@/lib/candy/catalog";

export default function CandyShape({
  audioClass,
  size = 56,
  wrapped = false,
  modifier = "default",
}: {
  audioClass: CandyAudioClass;
  size?: number;
  wrapped?: boolean;
  modifier?: CandyModifier;
}) {
  const config = AUDIO_CONFIG[audioClass];
  const label = getCandyVariantName(audioClass, modifier);
  const modClass = modifier !== "default" ? ` candy-mod-${modifier}` : "";

  return (
    <span
      className={`candy-shape ${config.css}${modClass}`}
      style={{ width: size, height: size }}
      aria-label={label}
    >
      {wrapped ? <span className="wrapped-band" /> : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
