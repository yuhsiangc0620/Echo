import { AUDIO_CONFIG, type CandyAudioClass } from "@/lib/candy/catalog";

export default function CandyShape({
  audioClass,
  size = 56,
  wrapped = false,
}: {
  audioClass: CandyAudioClass;
  size?: number;
  wrapped?: boolean;
}) {
  const config = AUDIO_CONFIG[audioClass];

  return (
    <span
      className={`candy-shape ${config.css}`}
      style={{ width: size, height: size }}
      aria-label={config.candyName}
    >
      {wrapped ? <span className="wrapped-band" /> : null}
      <span className="sr-only">{config.candyName}</span>
    </span>
  );
}
