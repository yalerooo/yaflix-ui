import { useEffect, useState } from "react";

const useIsAtTop = () => {
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    const onscroll = () => {
      setIsAtTop(window.scrollY === 0);
    };

    window.addEventListener("scroll", onscroll);
    return () => {
      window.removeEventListener("scroll", onscroll);
    };
  }, []);

  return isAtTop;
};

export { useIsAtTop };
