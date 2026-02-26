import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchIcon, X } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import qs from "qs";
import { usePathname, useRouter } from "next/navigation";
import { ServerApi } from "@/api";
import { useSettings } from "@/components/settings-provider";

const Context = createContext(
  {} as {
    open: boolean;
    onOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void;
  },
);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Plex.Metadata[]>([]);
  const [domLoaded, setDomLoaded] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useSettings();

  const handleReset = () => {
    setResults([]);
    setQuery("");
  };

  const handleOpen = (value: boolean | ((prev: boolean) => boolean)) => {
    if (typeof value === "function") {
      setOpen((prev) => {
        const state = value(prev);
        if (!state) handleReset();
        return state;
      });
    } else {
      setOpen(value);
      if (!value) handleReset();
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDomLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!domLoaded) return;

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleOpen((open) => !open);
      }
    };

    document.body.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [domLoaded]);

  const handleSearch = (value: string) => {
    setQuery(value);

    ServerApi.search({ query: value }).then((res) => {
      if (!res) {
        setResults([]);
        return;
      }

      const valid = res.filter(
        (item) =>
          item.Metadata &&
          (item.Metadata.type === "movie" ||
            item.Metadata.type === "show" ||
            item.Metadata.type === "episode"),
      );
      const ordered = valid.toSorted((a, b) => b.score - a.score);
      const mapped = ordered.map((item) => item.Metadata);
      const present = mapped.filter((elem) => elem !== undefined);
      setResults(present);
    });
  };

  const token = localStorage.getItem("token");

  return (
    <Context.Provider value={{ open, onOpen: handleOpen }}>
      {children}
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="overflow-hidden p-0" aria-describedby={undefined}>
          <DialogTitle className="sr-only">{t("search.dialogTitle")}</DialogTitle>
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
            <div className="flex flex-row items-center px-3 border-b">
              <SearchIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={t("search.placeholder")}
                onChange={({ target: { value } }) => handleSearch(value)}
                value={query}
              />
            </div>

            <ScrollArea className="max-h-[600px]">
              <CommandList className="max-h-[600px] no-scrollbar py-2">
                <div className="mx-3">
                  {results.length > 0 ? (
                    results.map((item, i) => (
                      <Button
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(
                            `${pathname}?mid=${item.ratingKey.toString()}`,
                            { scroll: false },
                          );
                          handleReset();
                          setOpen(false);
                        }}
                        key={`${item.key}-${i}`}
                        className="rounded overflow-hidden cursor-pointer mb-2 flex h-fit w-full flex-row gap-2 justify-start text-left items-center p-2"
                        asChild
                      >
                        <CommandItem
                          onSelect={() => {
                            router.push(
                              `${pathname}?mid=${item.ratingKey.toString()}`,
                              { scroll: false },
                            );
                            handleReset();
                            setOpen(false);
                          }}
                          className="overflow-hidden"
                        >
                          <img
                            loading="lazy"
                            width={60}
                            height={90}
                            src={`${localStorage.getItem("server")}/photo/:/transcode?${qs.stringify(
                              {
                                width: 60,
                                height: 90,
                                url: `${(item.type === "episode" ? item.parentThumb : item.thumb) || item.thumb}?X-Plex-Token=${token}`,
                                minSize: 1,
                                upscale: 1,
                                "X-Plex-Token": token,
                              },
                            )}`}
                            alt={t("search.resultPosterAlt")}
                            className="w-[60px] h-[90px] rounded"
                          />
                          <div className="max-w-max overflow-hidden">
                            <p className="truncate font-bold">
                              {item.title.slice(0, 60)}
                              {item.title.length > 60 && "..."}
                            </p>
                            {item.type === "episode" && (
                              <>
                                <p className="truncate text-muted-foreground font-bold text-sm">
                                  {item.grandparentTitle}
                                </p>
                                {item.parentIndex !== undefined &&
                                item.index !== undefined ? (
                                  <p className="truncate font-bold text-sm text-muted-foreground">
                                    S
                                    {item.parentIndex
                                      .toString()
                                      .padStart(2, "0")}
                                    {" • "}
                                    {item.index.toString().padStart(2, "0")}
                                    {" • "}
                                    {t("search.episodeLabel")}
                                  </p>
                                ) : (
                                  <p className="truncate font-bold text-sm text-muted-foreground">
                                    {t("search.episodeLabelLower")}
                                  </p>
                                )}
                              </>
                            )}
                            {item.type !== "episode" && (
                              <p className="line-clamp-1 font-bold capitalize text-sm text-muted-foreground">
                                {item.type}
                              </p>
                            )}
                          </div>
                        </CommandItem>
                      </Button>
                    ))
                  ) : (
                    <CommandEmpty className="py-6 px-2 text-center text-sm">
                      {t("search.noResults")}
                    </CommandEmpty>
                  )}
                </div>
              </CommandList>
            </ScrollArea>
          </Command>

          <DialogClose className="absolute right-4 top-3">
            <button
              type="button"
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </Context.Provider>
  );
}

export function useSearch() {
  return useContext(Context);
}
