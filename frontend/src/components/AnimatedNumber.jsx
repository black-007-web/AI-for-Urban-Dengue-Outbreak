import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';

export default function AnimatedNumber({ value, digits = 0, className = '' }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits }));
  useEffect(() => {
    const controls = animate(mv, Number(value) || 0, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}
