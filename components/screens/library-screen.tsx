import { FC, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePathname, useRouter } from "next/navigation";
import { Pencil, Search, X } from "lucide-react";
import { useItemKeyMetadata } from "@/hooks/use-item-key-metadata";
import { getPosterImage, getCoverImage } from "@/hooks/use-hub-item";
import { motion } from "framer-motion";
import qs from "qs";
import { useSession } from "@/hooks/use-session";
import { useSettings } from "@/components/settings-provider";

const canEditType = (type: Plex.LibraryType) => {
  return (
    type === "movie" ||
    type === "show" ||
    type === "season" ||
    type === "episode"
  );
};

const isAdminUser = (user: Plex.UserData | null) => {
  if (!user) return false;
  const sessionUser = user as Plex.UserData & {
    homeAdmin?: boolean;
    restricted?: boolean;
  };
  if (typeof sessionUser.homeAdmin === "boolean") return sessionUser.homeAdmin;
  if (typeof sessionUser.restricted === "boolean") return !sessionUser.restricted;
  return !!sessionUser.email;
};

export const LibraryScreen: FC<{
  keypath: string | undefined;
  title: string | undefined;
  contentDirectoryID: string | undefined;
}> = ({ keypath: key, title, contentDirectoryID }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();
  const { t } = useSettings();
  const isAdmin = isAdminUser(user);
  const { loading, metadata, lastRef } = useItemKeyMetadata(
    key,
    contentDirectoryID,
  );

  const [searchQuery, setSearchQuery] = useState("");

  const filteredMetadata = useMemo(() => {
    if (!searchQuery.trim()) return metadata;
    const q = searchQuery.toLowerCase();
    return metadata.filter((item) => item.title?.toLowerCase().includes(q));
  }, [metadata, searchQuery]);

  const handleClose = () => {
    router.replace(pathname, { scroll: false });
  };

  return (
    <Dialog
      open={!!key}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent className="max-w-full max-h-[100vh] h-full w-full p-0 border-none bg-black overflow-y-auto overflow-x-hidden">
        <DialogTitle className="sr-only">
          {title || t("libraryScreen.libraryFallbackTitle")}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {t("libraryScreen.browseItems")}
        </DialogDescription>

        {/* Background — blurred gradient */}
        <div className="sticky top-0 h-screen w-full -mb-[100vh] z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black to-blue-900/30" />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Navbar — glassmorphic capsules */}
        <div className="sticky top-0 z-[45] flex justify-center items-center h-[4.5rem] w-full py-4">
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 text-white/90 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg"
            >
              {t("libraryScreen.home")}
            </a>
            <a
              href="/browse/2"
              className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 text-white/90 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg"
            >
              {t("libraryScreen.movies")}
            </a>
            <a
              href="/browse/1"
              className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 text-white/90 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg"
            >
              {t("libraryScreen.anime")}
            </a>
            <button 
              onClick={handleClose} 
              className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full p-2 text-white hover:bg-white/20 hover:text-white transition-all duration-200 shadow-lg" 
              title={t("libraryScreen.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative min-h-screen w-full min-w-0 z-10 -mt-[4.5rem]">
          {/* Hero Section */}
          <div className="relative z-10 pb-8">
            <div className="relative px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 pt-20 pb-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                {title && (
                  <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] tracking-tight leading-tight mb-4">
                    {title}
                  </h1>
                )}
                <p className="text-white/70 text-lg sm:text-xl">
                  {filteredMetadata.length}{" "}
                  {filteredMetadata.length === 1
                    ? t("libraryScreen.item")
                    : t("libraryScreen.items")}
                </p>
              </motion.div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 mb-8">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <input
                type="text"
                placeholder={t("libraryScreen.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 backdrop-blur-lg bg-white/10 border border-white/20 rounded-full text-white placeholder-white/40 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all duration-200 shadow-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Content Grid */}
          <div className="px-4 sm:px-8 md:px-16 lg:px-24 xl:px-32 pb-16">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
            >
              {loading &&
                Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] bg-white/5 rounded-xl animate-pulse backdrop-blur-sm border border-white/10" />
                ))}
              {filteredMetadata.map((item, i) => {
                const isCollection = item.type === "collection";
                const posterSrc = item.thumb 
                  ? getPosterImage(item.thumb, false, true) 
                  : item.art 
                    ? getCoverImage(item.art, false, true) 
                    : null;
                
                return (
                  <motion.div
                    key={i}
                    ref={
                      i === metadata.length - 1
                        ? (lastRef as (node: HTMLDivElement) => void)
                        : undefined
                    }
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                    className="group text-left transition-all duration-300 hover:scale-[1.03] cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      if (isCollection) {
                        router.push(
                          `${pathname}?${qs.stringify({ key: item.key, libtitle: item.title })}`,
                          { scroll: false },
                        );
                        return;
                      }
                      router.push(`${pathname}?mid=${item.ratingKey}`, { scroll: false });
                    }}
                    onClick={() => {
                      if (isCollection) {
                        router.push(
                          `${pathname}?${qs.stringify({ key: item.key, libtitle: item.title })}`,
                          { scroll: false }
                        );
                      } else {
                        router.push(`${pathname}?mid=${item.ratingKey}`, { scroll: false });
                      }
                    }}
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 bg-white/5">
                      {isAdmin && canEditType(item.type) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `${pathname}?${qs.stringify({ mid: item.ratingKey, edit: 1 })}`,
                              { scroll: false },
                            );
                          }}
                          className="absolute top-2 left-2 z-20 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                          title={t("libraryScreen.editMetadata")}
                        >
                          <Pencil className="w-3.5 h-3.5 text-white" />
                        </button>
                      )}
                      {posterSrc ? (
                        <img
                          loading="lazy"
                          src={posterSrc}
                          alt={item.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
                          <span className="text-white/40 text-4xl font-bold">{item.title?.charAt(0)}</span>
                        </div>
                      )}
                      {/* Watched indicator */}
                      {(item.viewCount ?? 0) > 0 && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Title and metadata below poster */}
                    <div className="mt-2 px-1">
                      <p className="text-white font-semibold text-sm line-clamp-2">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-white/50 text-xs">
                        {item.year && <span>{item.year}</span>}
                        {isCollection && item.childCount && (
                          <span>
                            {item.childCount} {t("libraryScreen.items")}
                          </span>
                        )}
                        {item.contentRating && (
                          <span className="px-1.5 py-0.5 border border-white/20 rounded text-[10px]">{item.contentRating}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Loading more indicator */}
            {loading && metadata.length > 0 && (
              <div className="mt-8 flex justify-center">
                <div className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-3 text-white/80 text-sm font-medium shadow-lg">
                  {t("libraryScreen.loadingMore")}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
