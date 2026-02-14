import {
  createContext,
  Dispatch,
  FC,
  ReactNode,
  SetStateAction,
  TouchEvent,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DESKTOP_BREAKPOINT,
  GIANT_BREAKPOINT,
  MOBILE_BREAKPOINT,
  TABLET_BREAKPOINT,
  TINY_BREAKPOINT,
} from "@/hooks/use-is-size";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CarouselWrapperContext = createContext(
  {} as {
    openIndex: string | null;
    setOpenIndex: Dispatch<SetStateAction<string | null>>;
  },
);

export const CarouselWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  return (
    <CarouselWrapperContext.Provider value={{ openIndex, setOpenIndex }}>
      {children}
    </CarouselWrapperContext.Provider>
  );
};

export const CarouselContext = createContext(
  {} as {
    size: number;
    firstIndex: number;
    lastIndex: number;
    spacing: number;
    scale: number;
    openIndex: string | null;
    open: (refKey: string) => void;
    close: () => void;
  },
);

const CarouselProvider: FC<{
  children: ReactNode;
  size: number;
  firstIndex: number;
  lastIndex: number;
  spacing: number;
  scale: number;
}> = ({ children, size, firstIndex, lastIndex, spacing, scale }) => {
  const { openIndex, setOpenIndex } = useContext(CarouselWrapperContext);

  const close = () => {
    setOpenIndex(null);
  };

  const open = (refKey: string) => {
    setOpenIndex(refKey);
  };

  return (
    <CarouselContext.Provider
      value={{
        size,
        firstIndex,
        lastIndex,
        spacing,
        scale,
        openIndex,
        open,
        close,
      }}
    >
      {children}
    </CarouselContext.Provider>
  );
};

export const useCarouselItem = (index: number, refKey: string) => {
  const { size, firstIndex, lastIndex, spacing, openIndex, open, close } =
    useContext(CarouselContext);

  const isOpen = useMemo(() => openIndex === refKey, [openIndex, refKey]);

  return {
    size: size - spacing,
    firstIndex,
    lastIndex,
    isFirst: index === firstIndex,
    isLast: index === lastIndex,
    spacing,
    isOpen,
    open: () => open(refKey),
    close,
  };
};

const Carousel: FC<{
  children: ReactNode;
  edges?: number;
  spacing?: number;
  scale?: number;
  minimumVisibleItem?: number;
}> = ({
  children,
  edges = 40,
  spacing = 10,
  scale = 1.2,
  minimumVisibleItem = 1,
}) => {
  const { close } = useContext(CarouselContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAtEndOfScroll, setIsAtEndOfScroll] = useState(false);
  const [isAtStartOfScroll, setIsAtStartOfScroll] = useState(true);
  const [isContainerScrollable, setIsContainerScrollable] = useState(false);
  const [numberOfItemsVisible, setNumberOfItemsVisible] = useState(0);
  const [size, setSize] = useState(0);
  const [startMove, setStartMove] = useState<number | null>(null);
  const [moved, setMoved] = useState<boolean>(false);

  // MUST NOT TOUCH THIS USE EFFECT
  useEffect(() => {
    if (!containerRef.current) return;
    const onscroll = (baseSize = size) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      setIsContainerScrollable(container.scrollWidth > container.offsetWidth);
      setIsAtStartOfScroll(container.scrollLeft === 0);
      setNumberOfItemsVisible(
        Math.floor((container.offsetWidth - edges * 2 + spacing) / baseSize),
      );

      const isAtStart = container.scrollLeft === 0;
      setIsAtStartOfScroll(() => isAtStart);

      const scrollDelta =
        container.scrollLeft - (container.scrollWidth - container.offsetWidth);
      const isAtEnd = Math.min(Math.ceil(scrollDelta), 0) === 0;
      setIsAtEndOfScroll(() => isAtEnd);

      const maxScrollLeft = Math.max(container.scrollLeft - edges, 0);

      const itemWidthWithMargin =
        baseSize - spacing + (maxScrollLeft < spacing ? 0 : spacing);

      let index = Math.floor(maxScrollLeft / itemWidthWithMargin);

      if (maxScrollLeft % baseSize !== 0) {
        index++;
      }

      setCurrentIndex(() => index);
    };

    onscroll();

    const scrollbase = () => onscroll();

    containerRef.current.addEventListener("scroll", scrollbase);
    return () => {
      containerRef.current?.removeEventListener("scroll", scrollbase);
    };
  }, [size]);

  useEffect(() => {
    const wheelscroll = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) !== 0) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    containerRef.current?.addEventListener("wheel", wheelscroll, {
      passive: false,
    });
    return () => {
      containerRef.current?.removeEventListener("wheel", wheelscroll);
    };
  }, []);

  useEffect(() => {
    const calcSize = (divider: number) => {
      if (!containerRef.current) return 0;
      return Math.floor(
        (containerRef.current.offsetWidth - edges * 2) / divider,
      );
    };

    const sizechange = () => {
      let updatedSize: number;
      if (window.innerWidth < 520) {
        updatedSize = calcSize(minimumVisibleItem);
      } else if (window.innerWidth < TINY_BREAKPOINT) {
        updatedSize = calcSize(minimumVisibleItem + 1);
      } else if (window.innerWidth < MOBILE_BREAKPOINT) {
        updatedSize = calcSize(minimumVisibleItem + 2);
      } else if (window.innerWidth < TABLET_BREAKPOINT) {
        updatedSize = calcSize(minimumVisibleItem + 3);
      } else if (window.innerWidth < DESKTOP_BREAKPOINT) {
        updatedSize = calcSize(minimumVisibleItem + 4);
      } else if (window.innerWidth < GIANT_BREAKPOINT) {
        updatedSize = calcSize(minimumVisibleItem + 5);
      } else {
        updatedSize = calcSize(minimumVisibleItem + 6);
      }

      setSize(updatedSize);
      return updatedSize;
    };

    sizechange();

    const onresize = () => {
      const updatedSize = sizechange();
      if (containerRef.current) {
        const updatedNumberOfItemsVisible = Math.floor(
          (containerRef.current.offsetWidth - edges * 2 + spacing) /
            updatedSize,
        );
        setNumberOfItemsVisible(updatedNumberOfItemsVisible);
        containerRef.current.scroll(currentIndex * updatedSize, 0);
      }
    };

    window.addEventListener("resize", onresize, { passive: true });

    return () => {
      window.removeEventListener("resize", onresize);
    };
  }, [currentIndex, minimumVisibleItem, edges]);

  const handlePrevious = () => {
    if (!containerRef.current) return;
    containerRef.current.scroll(
      currentIndex <= numberOfItemsVisible
        ? 0
        : Math.max((currentIndex - numberOfItemsVisible) * size, 0),
      0,
    );
  };

  const handleNext = () => {
    if (!containerRef.current) return;
    containerRef.current.scroll(
      (currentIndex + numberOfItemsVisible) * size,
      0,
    );
  };

  // TODO: fix on click/touch events and vertical scroll
  useEffect(() => {
    const onmove = (e: TouchEvent) => {
      e.preventDefault();
      if (!moved) {
        if (startMove === null) {
          setStartMove(e.touches[0].clientX);
        } else {
          const diff = startMove - e.touches[0].clientX;
          const diffAbs = Math.abs(diff);
          if (diffAbs > 50) {
            if (diff < 0) {
              handlePrevious();
            } else {
              handleNext();
            }
            setMoved(true);
          }
        }
      }
    };

    const touchend = () => {
      setMoved(false);
      setStartMove(null);
    };

    const container = containerRef.current;
    if (container) {
      // @ts-ignore
      container.addEventListener("touchmove", onmove, { passive: false });
      container.addEventListener("touchend", touchend);
    }

    return () => {
      if (container) {
        // @ts-ignore
        container.removeEventListener("touchmove", onmove);
        container.removeEventListener("touchend", touchend);
      }
    };
  }, [startMove, moved]);

  return (
    <div className="max-w-full w-full relative group mx-auto">
      <button
        className={cn(
          `absolute left-0 top-0 bottom-0 flex-row justify-center items-center z-50 bg-gradient-to-r from-background to-transparent`,
          !isContainerScrollable ? "" : "flex",
        )}
        onClick={handlePrevious}
        style={{ width: `${edges}px` }}
        disabled={isAtStartOfScroll}
        onMouseEnter={close}
      >
        <ChevronLeft
          size={40}
          color={"#ffffff"}
          className={cn(
            "transition opacity-0",
            isAtStartOfScroll
              ? ""
              : "group-hover:opacity-100 group-hover:block",
          )}
        />
      </button>
      <button
        className={cn(
          `absolute right-0 top-0 bottom-0 flex-row justify-center items-center carousel-button z-50 bg-gradient-to-l from-background to-transparent`,
          !isContainerScrollable ? "" : "flex",
        )}
        onClick={handleNext}
        style={{ width: `${edges}px` }}
        disabled={isAtEndOfScroll}
        onMouseEnter={close}
      >
        <ChevronRight
          size={40}
          color={"#ffffff"}
          className={cn(
            "transition opacity-0",
            isAtEndOfScroll ? "" : "group-hover:opacity-100 group-hover:block",
          )}
        />
      </button>
      <div
        className="flex flex-row max-w-full overflow-x-auto scroll-smooth no-scrollbar"
        ref={containerRef}
        style={{
          paddingLeft: `${edges}px`,
          paddingRight: `${edges}px`,
          gap: `${spacing}px`,
        }}
      >
        <CarouselProvider
          size={size}
          firstIndex={currentIndex}
          lastIndex={currentIndex + numberOfItemsVisible - 1}
          spacing={spacing}
          scale={scale}
        >
          {size === 0 ? null : children}
        </CarouselProvider>
      </div>
    </div>
  );
};

export default Carousel;
