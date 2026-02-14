import { useEffect, useState } from "react";

export const GIANT_BREAKPOINT = 2000;
export const DESKTOP_BREAKPOINT = 1800;
export const TABLET_BREAKPOINT = 1400;
export const MOBILE_BREAKPOINT = 1000;
export const TINY_BREAKPOINT = 768;

const useIsSize = () => {
  const [isGiant, setIsGiant] = useState<boolean | undefined>(undefined);
  const [isDesktop, setIsDesktop] = useState<boolean | undefined>(undefined);
  const [isTablet, setIsTablet] = useState<boolean | undefined>(undefined);
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);
  const [isTiny, setIsTiny] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const onChange = () => {
      setIsGiant(window.innerWidth < GIANT_BREAKPOINT);
      setIsDesktop(window.innerWidth < DESKTOP_BREAKPOINT);
      setIsTablet(window.innerWidth < TABLET_BREAKPOINT);
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      setIsTiny(window.innerWidth < TINY_BREAKPOINT);
    };

    // Set initial state
    onChange();

    // Add event listener
    window.addEventListener("resize", onChange);

    // Cleanup event listener on unmount
    return () => window.removeEventListener("resize", onChange);
  }, []);

  return {
    isGiant: !!isGiant,
    isDesktop: !!isDesktop,
    isTablet: !!isTablet,
    isMobile: !!isMobile,
    isTiny: !!isTiny,
  };
};

export { useIsSize };
