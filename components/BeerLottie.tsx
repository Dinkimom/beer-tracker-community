'use client';

import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

const BEER_LOTTIE_URL = '/assets/beer-emoji.json';

export interface BeerLottieRef {
  play: () => void;
}

const DEFAULT_SIZE = 32;

export const BeerLottie = forwardRef<BeerLottieRef, { className?: string; size?: number }>(function BeerLottie(
  { className, size = DEFAULT_SIZE },
  ref
) {
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    fetch(BEER_LOTTIE_URL)
      .then((res) => res.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null));
  }, []);

  const play = useCallback(() => {
    if (lottieRef.current) {
      lottieRef.current.goToAndPlay(0, true);
    }
  }, []);

  useImperativeHandle(ref, () => ({ play }), [play]);

  if (!animationData) {
    return (
      <span
        aria-label="Логотип"
        className="leading-none select-none inline-flex items-center justify-center"
        role="img"
        style={{ width: size, height: size, fontSize: size * 0.6 }}
      >
        🍺
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`flex items-center justify-center select-none ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Lottie
        animationData={animationData}
        autoplay={false}
        loop={false}
        lottieRef={lottieRef}
        style={{ width: size, height: size }}
      />
    </span>
  );
});
