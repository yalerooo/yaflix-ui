import { FC, forwardRef, ReactNode, useEffect, useRef, useState } from "react";
import { CarouselItemHover, useCarouselItem } from "@/components/carousel";

const CarouselItem = forwardRef<
  HTMLDivElement,
  {
    children: ReactNode;
    hoverview: ReactNode;
    index: number;
    refKey: string;
  }
>(({ children, hoverview, index, refKey }, ref) => {
  const { size, isFirst, isLast, open, close, isOpen } = useCarouselItem(
    index,
    refKey,
  );
  const itemRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState({
    top: 0,
    left: 0,
    height: 0,
  });
  const d = 220;

  useEffect(() => {
    if (!itemRef.current) return;

    let timer: NodeJS.Timeout;

    const enter = () => {
      if (itemRef.current) {
        const height = itemRef.current.offsetHeight;
        const top = itemRef.current.getBoundingClientRect().top;
        const left = itemRef.current.getBoundingClientRect().left;
        setOrigin({ top, left, height });
      }

      timer = setTimeout(open, d);
    };
    const leave = () => {
      clearTimeout(timer);
    };

    itemRef.current.addEventListener("pointerenter", enter);
    itemRef.current.addEventListener("pointerleave", leave);

    return () => {
      itemRef.current?.removeEventListener("pointerenter", enter);
      itemRef.current?.removeEventListener("pointerleave", leave);
    };
  }, [itemRef.current]);

  return (
    <div
      className="group overflow-hidden relative h-full flex flex-col rounded-xl"
      style={{
        minWidth: `${size}px`,
        width: `${size}px`,
        maxWidth: `${size}px`,
      }}
      ref={itemRef}
    >
      <div ref={ref} />
      {hoverview && itemRef.current && (
        <CarouselItemHover
          refKey={refKey}
          open={isOpen}
          left={origin.left}
          top={origin.top}
          width={size}
          height={origin.height}
          duration={d}
          onLeave={close}
          isFirst={isFirst}
          isLast={isLast}
        >
          {hoverview}
        </CarouselItemHover>
      )}
      {children}
    </div>
  );
});

export default CarouselItem;
