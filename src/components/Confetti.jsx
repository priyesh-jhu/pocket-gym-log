import { useEffect, useState } from "react";
import useReducedMotion from "../hooks/useReducedMotion.js";
import "./Confetti.css";

const COLORS = ["#C8F065", "#A8C7FA", "#F4A6A0", "#D9B8FF", "#7EE8C0", "#F0C36D"];
const PIECE_COUNT = 28;
const LIFETIME_MS = 2200;

function randomPieces() {
  return Array.from({ length: PIECE_COUNT }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    duration: 1.6 + Math.random() * 0.8,
    drift: Math.round((Math.random() - 0.5) * 140),
    spin: Math.round(360 + Math.random() * 360),
    color: COLORS[index % COLORS.length],
  }));
}

/** A brief, dependency-free confetti burst. Renders nothing if `active` is false or the user prefers reduced motion. */
export default function Confetti({ active, onDone }) {
  const reducedMotion = useReducedMotion();
  const celebrating = active && !reducedMotion;
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    if (!celebrating) return undefined;
    setPieces(randomPieces());
    const timer = setTimeout(() => onDone?.(), LIFETIME_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone is a stable setter from the caller; including it would restart the burst if the caller re-renders mid-animation.
  }, [celebrating]);

  if (pieces.length === 0 || !celebrating) return null;

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map(piece => (
        <span
          key={piece.id}
          className="confetti__piece"
          style={{
            left: `${piece.left}%`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            "--confetti-drift": `${piece.drift}px`,
            "--confetti-spin": `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
