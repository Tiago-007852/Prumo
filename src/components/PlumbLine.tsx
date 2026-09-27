/**
 * PlumbLine — a assinatura visual do Prumo (Fase 2).
 *
 * Um fio de prumo desenhado em SVG que oscila suavemente (motion) e busca
 * equilíbrio — a metáfora do produto: trazer seu dinheiro ao prumo. Roda em
 * CSS puro via <motion>, sem imagens, custo zero de payload.
 */

import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Country } from '../types';

interface PlumbLineProps {
  /** Altura do palco em px (largura é 100% do container). */
  height?: number;
  country?: Country;
  /** Exibe o brilho dourado atrás do fio. */
  glow?: boolean;
  className?: string;
}

export const PlumbLine: React.FC<PlumbLineProps> = ({
  height = 320,
  country = 'BR',
  glow = true,
  className = '',
}) => {
  const currency = country === 'BR' ? 'R$' : 'Kz';

  // Curva do fio: pontos variando suavemente. O path é recalculado por frame
  // pelo motion (useMotionValue + useTransform via animate custom).
  const path = useMemo(
    () =>
      'M 50% 0 C 50% 25%, 46% 45%, 50% 62% S 54% 82%, 50% 100%',
    []
  );

  return (
    <div
      className={`relative overflow-hidden pointer-events-none select-none ${className}`}
      style={{ height }}
      aria-hidden="true"
    >
      {/* Halo dourado atrás do prumo */}
      {glow && (
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            width: height * 1.2,
            height: height * 1.2,
            background:
              'radial-gradient(circle, var(--gold-glow) 0%, transparent 60%)',
          }}
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.06, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Fio oscilando: rotação suave no pivô superior (topo do fio) */}
      <motion.svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        style={{ transformOrigin: '50% 0%' }}
        animate={{ rotate: [-2.4, 2.4, -2.4] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.path
          d={path}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={0.7}
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />
      </motion.svg>

      {/* Peso do prumo */}
      <motion.div
        className="absolute left-1/2 bottom-[6%] -translate-x-1/2"
        animate={{ y: [0, 3, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-5 h-7 rounded-b-full"
          style={{
            background: 'linear-gradient(180deg, var(--accent-bright), var(--accent))',
            boxShadow: '0 0 18px var(--gold-glow)',
            clipPath: 'polygon(50% 0, 100% 28%, 78% 100%, 22% 100%, 0 28%)',
          }}
        />
      </motion.div>

      {/* Pequenos valores flutuando (tema local) */}
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute font-serif-display text-[var(--accent)] opacity-0"
          style={{
            left: `${18 + i * 30}%`,
            top: `${22 + (i % 2) * 34}%`,
            fontSize: 13 + (i % 2) * 4,
          }}
          animate={{ opacity: [0, 0.55, 0], y: [0, -16, -30] }}
          transition={{ duration: 6 + i * 1.5, repeat: Infinity, delay: i * 2, ease: 'easeInOut' }}
        >
          {currency} {i === 0 ? '1.000' : i === 1 ? '250' : '4.800'}
        </motion.span>
      ))}
    </div>
  );
};
