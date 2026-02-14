import { FC, useMemo } from "react";
import { getPosterImage } from "@/hooks/use-hub-item";
import { cn } from "@/lib/utils";
import * as React from "react";
import { ElementImagePreviewItem } from "@/components/cards/element-image-preview-item";

export const OtherImagePreviewItem: FC<
  Omit<
    React.ComponentPropsWithoutRef<typeof ElementImagePreviewItem>,
    "image"
  > & { higherResolution?: boolean }
> = ({ item, higherResolution, className, ...rest }) => {
  const image = useMemo(() => {
    if (item.type === "episode")
      return getPosterImage(
        item.parentThumb ?? item.grandparentThumb ?? item.thumb,
        false,
        higherResolution,
      );
    if (item.type === "season")
      return getPosterImage(
        item.thumb ?? item.parentThumb,
        false,
        higherResolution,
      );
    return getPosterImage(item.thumb, false, higherResolution);
  }, [item]);

  return (
    <ElementImagePreviewItem
      item={item}
      image={image}
      className={cn("aspect-[9/14]", className)}
      {...rest}
    />
  );
};
