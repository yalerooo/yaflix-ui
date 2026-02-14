import { FC, forwardRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getPosterImage } from "@/hooks/use-hub-item";
import qs from "qs";

export const CollectionPreviewItem = forwardRef<
  HTMLButtonElement,
  { item: Plex.Metadata }
>(({ item }, ref) => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <button
      ref={ref}
      className="relative text-left"
      onClick={() => {
        router.push(
          `${pathname}?${qs.stringify({
            key: item.key,
            libtitle: item.title,
          })}`,
          { scroll: false },
        );
      }}
    >
      <img
        loading="lazy"
        className="w-full object-cover aspect-[9/14] top-0 rounded"
        src={getPosterImage(item.thumb, false, true)}
        alt="season poster"
      />
      <div className="p-2 w-full font-semibold">
        <p className="truncate">{item.title}</p>
        <p className="text-muted-foreground truncate">
          {item.childCount} Items
        </p>
      </div>
    </button>
  );
});
