import { FC, useMemo } from "react";
import { extractClearLogo, getCoverImage } from "@/hooks/use-hub-item";
import { ElementImagePreviewItem } from "@/components/cards/element-image-preview-item";
import * as React from "react";
import { cn } from "@/lib/utils";

export const OnDeckImagePreviewItem: FC<
  Omit<
    React.ComponentPropsWithoutRef<typeof ElementImagePreviewItem>,
    "image"
  > & { higherResolution?: boolean }
> = ({ item, className, higherResolution, ...rest }) => {
  const clearLogo = extractClearLogo(item);
  const image = useMemo(() => {
    if (item.type === "movie")
      return getCoverImage(item.art, false, higherResolution);
    if (item.type === "episode")
      return getCoverImage(
        (clearLogo && item.thumb) ?? item.thumb ?? item.art,
        false,
        higherResolution,
      );
    return getCoverImage(
      item.grandparentArt ?? item.art,
      false,
      higherResolution,
    );
  }, [item]);

  return (
    <ElementImagePreviewItem
      item={item}
      clearLogo={clearLogo}
      image={image}
      className={cn("aspect-video", className)}
      {...rest}
    />
  );
};
