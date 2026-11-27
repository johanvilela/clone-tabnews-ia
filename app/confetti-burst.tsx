"use client";

import { useEffect, useState } from "react";
import Confetti from "react-confetti";

type Viewport = {
  width: number;
  height: number;
};

export default function ConfettiBurst() {
  const [viewport, setViewport] = useState<Viewport>({ width: 0, height: 0 });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  if (!visible || viewport.width === 0 || viewport.height === 0) return null;

  return (
    <div className="confetti-layer" aria-hidden="true">
      <Confetti
        width={viewport.width}
        height={viewport.height}
        numberOfPieces={350}
        recycle={false}
        gravity={0.22}
        initialVelocityY={{ min: 4, max: 12 }}
        tweenDuration={4000}
        colors={[
          "#2f6f4f",
          "#3f8f63",
          "#f2b134",
          "#e07a3f",
          "#26547c",
          "#7fb069",
          "#f4f1de",
        ]}
        onConfettiComplete={() => setVisible(false)}
      />
    </div>
  );
}
