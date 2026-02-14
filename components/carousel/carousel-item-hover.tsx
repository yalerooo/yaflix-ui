import { FC, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { lerp } from "@/lib/utils";
import { createPortal } from "react-dom";
import { CarouselContext } from "@/components/carousel";

const CarouselItemHover: FC<{
  open: boolean;
  top: number;
  left: number;
  width: number;
  height: number;
  children: ReactNode;
  onLeave: () => void;
  duration: number;
  isFirst: boolean;
  isLast: boolean;
  refKey: string;
}> = ({
  open,
  children,
  onLeave,
  duration,
  width,
  height,
  top,
  left,
  isFirst,
  isLast,
  refKey,
}) => {
  const { scale } = useContext(CarouselContext);
  const hoverRef = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState({
    width,
    top: top,
    left,
    scale: 1,
    opacity: 0,
    visible: open,
  });
  const [windowScrollTopOnOpen, setWindowScrollTopOnOpen] = useState(
    window.scrollY,
  );

  useEffect(() => {
    if (!hoverRef.current) return;

    hoverRef.current.addEventListener("mouseleave", onLeave);
    return () => {
      hoverRef.current?.removeEventListener("mouseleave", onLeave);
    };
  }, [hoverRef.current]);

  useEffect(() => {
    const getLeft = () => {
      if (isFirst && isLast) {
        return left;
      }

      if (isFirst) {
        return left + width * (1 + (scale - 1) / 2) - width - 2;
      }

      if (isLast) {
        return left - (width * (1 + (scale - 1) / 2) - width) + 2;
      }

      return left;
    };

    if (open) {
      setWindowScrollTopOnOpen(window.scrollY);
    }

    const target = open
      ? {
          width: width,
          scale: scale,
          top: top,
          left: getLeft(),
          opacity: 1,
          visible: true,
        }
      : {
          width,
          scale: 1,
          top: top,
          left,
          opacity: 0,
          visible: false,
        };

    let frameId: number;
    const d = duration; // animation duration in ms
    const startTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const t = Math.min((now - startTime) / (target.visible ? d : d / 3), 1); // normalize time to range [0, 1]

      setCurrent((prev) => ({
        width: lerp(prev.width, target.width, t),
        scale: lerp(prev.scale, target.scale, t),
        top: lerp(prev.top, target.top, t),
        left: lerp(prev.left, target.left, t),
        opacity: lerp(prev.opacity, target.opacity, t),
        visible: open
          ? target.visible
          : t > 0.96
            ? target.visible
            : prev.visible,
      }));

      if (t < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [open, width, top, left]);

  if (!current.visible) return null;

  return createPortal(
    <div
      ref={hoverRef}
      className="absolute z-50 rounded-2xl overflow-hidden glass-dark glass-glow"
      style={{
        top: current.top + windowScrollTopOnOpen,
        left: current.left,
        width: current.width,
        scale: current.scale,
        opacity: current.opacity,
      }}
    >
      {children}
    </div>,
    document.body,
    refKey,
  );
};

export default CarouselItemHover;
