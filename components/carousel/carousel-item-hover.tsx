import { FC, ReactNode, useContext, useEffect, useRef, useState } from "react";
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
  width,
  top,
  left,
  isFirst,
  isLast,
  refKey,
}) => {
  const { scale } = useContext(CarouselContext);
  const hoverRef = useRef<HTMLDivElement>(null);
  // Two-phase visibility: `visible` mounts the DOM node, `isOpen` triggers the CSS transition.
  const [visible, setVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!hoverRef.current) return;
    hoverRef.current.addEventListener("mouseleave", onLeave);
    return () => {
      hoverRef.current?.removeEventListener("mouseleave", onLeave);
    };
  }, [hoverRef.current, onLeave]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      // Double-RAF ensures element is painted before transition starts
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      // Unmount after the close transition finishes (120ms)
      const timer = setTimeout(() => setVisible(false), 120);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const getLeft = () => {
    if (isFirst && isLast) return left;
    if (isFirst) return left + width * (1 + (scale - 1) / 2) - width - 2;
    if (isLast) return left - (width * (1 + (scale - 1) / 2) - width) + 2;
    return left;
  };

  if (!visible) return null;

  return createPortal(
    <div
      ref={hoverRef}
      className="fixed z-50 rounded-2xl overflow-hidden glass-dark glass-glow"
      style={{
        top,
        left: getLeft(),
        width,
        transformOrigin: isFirst ? "left center" : isLast ? "right center" : "center center",
        transform: `scale(${isOpen ? scale : 1})`,
        opacity: isOpen ? 1 : 0,
        transition: isOpen
          ? "transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 150ms ease"
          : "transform 120ms ease, opacity 120ms ease",
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>,
    document.body,
    refKey,
  );
};

export default CarouselItemHover;
