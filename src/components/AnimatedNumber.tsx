/**
 * AnimatedNumber — contador dourado do Prumo (Fase 2).
 *
 * Anima o valor de 0 (ou do valor anterior) até o alvo com easing suave,
 * formatando na moeda do país. Usa motion (já no projeto) sem dependências
 * extras. Reduz movimento se o usuário pediu prefers-reduced-motion.
 */

import React, { useEffect, useRef, useState } from 'react';
import { animate } from 'motion/react';
import { Country } from '../types';
import { formatCurrency } from '../services/businessRules';

interface AnimatedNumberProps {
  value: number;
  country: Country;
  className?: string;
  /** Duração da animação em ms. */
  duration?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  country,
  className = '',
  duration = 900,
}) => {
  const [display, setDisplay] = useState(0);
  const previousRef = useRef(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      setDisplay(value);
      previousRef.current = value;
      return;
    }

    const controls = animate(previousRef.current, value, {
      duration: duration / 1000,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });

    previousRef.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatCurrency(Math.round(display * 100) / 100, country)}
    </span>
  );
};
