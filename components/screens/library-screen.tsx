import { FC, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePathname, useRouter } from "next/navigation";
import { BookMarked, Clapperboard, Eye, EyeOff, History, Link2, ListPlus, MoreVertical, Pencil, Play, RefreshCw, Search, Shuffle, SkipForward, Trash2, X, Zap } from "lucide-react";
import { useItemKeyMetadata } from "@/hooks/use-item-key-metadata";
import { getPosterImage, getCoverImage } from "@/hooks/use-hub-item";
import { motion } from "framer-motion";
import qs from "qs";
import { useSession } from "@/hooks/use-session";
import { useSettings } from "@/components/settings-provider";
import { ServerApi } from "@/api";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MetadataEditorDialog } from "@/components/metadata-editor-dialog";

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
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<Plex.Metadata | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [historyItem, setHistoryItem] = useState<Plex.Metadata | null>(null);
  const [historyData, setHistoryData] = useState<Array<{ viewedAt: number; title: string }> | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editMetadataKey, setEditMetadataKey] = useState<string | null>(null);


  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleMarkWatched = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    const isWatched = (item.viewCount ?? 0) > 0;
    await ServerApi[isWatched ? "unscrobble" : "scrobble"]({ key: item.ratingKey });
    router.refresh();
  };

  const handleRefreshMetadata = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    await ServerApi.refreshMetadata({ id: item.ratingKey });
    showToast(t("libraryScreen.contextMenu.refreshMetadata"));
  };

  const handleAnalyze = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    await ServerApi.analyze({ id: item.ratingKey });
    showToast(t("libraryScreen.contextMenu.analyze"));
  };

  const handleOptimize = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    await ServerApi.optimize({ id: item.ratingKey });
    showToast(t("libraryScreen.contextMenu.optimize"));
  };

  const handleUnmatch = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    await ServerApi.unmatch({ id: item.ratingKey });
    router.refresh();
  };

  const handleShare = (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${pathname}?mid=${item.ratingKey}`;
    navigator.clipboard.writeText(url).then(() => showToast(t("libraryScreen.contextMenu.linkCopied")));
  };

  const handleRandom = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.librarySectionID) return;
    const random = await ServerApi.random({ dir: String(item.librarySectionID) });
    if (random) {
      router.push(`${pathname}?mid=${random.ratingKey}`, { scroll: false });
    }
  };

  const handlePlayNext = (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const queue: string[] = JSON.parse(localStorage.getItem("playNextQueue") ?? "[]");
      if (!queue.includes(item.ratingKey)) {
        queue.unshift(item.ratingKey);
        localStorage.setItem("playNextQueue", JSON.stringify(queue.slice(0, 50)));
      }
      showToast(t("libraryScreen.contextMenu.addedToQueue"));
    } catch { /* ignore */ }
  };

  const handleAddToQueue = (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const queue: string[] = JSON.parse(localStorage.getItem("playNextQueue") ?? "[]");
      if (!queue.includes(item.ratingKey)) {
        queue.push(item.ratingKey);
        localStorage.setItem("playNextQueue", JSON.stringify(queue.slice(0, 50)));
      }
      showToast(t("libraryScreen.contextMenu.addedToQueue"));
    } catch { /* ignore */ }
  };

  const handleAddToWatchlist = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    await ServerApi.addToWatchlist({ guid: item.guid });
    showToast(t("libraryScreen.contextMenu.addToWatchlist"));
  };

  const handleViewHistory = async (item: Plex.Metadata, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryItem(item);
    setHistoryData(null);
    const history = await ServerApi.history({ id: item.ratingKey });
    setHistoryData(
      (history ?? []).map((h) => ({ viewedAt: h.viewedAt, title: h.title }))
    );
  };

  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    setDeletingId(deleteConfirmItem.ratingKey);
    await ServerApi.deleteItem({ id: deleteConfirmItem.ratingKey });
    setDeleteConfirmItem(null);
    setDeletingId(null);
    router.refresh();
  };

  const filteredMetadata = useMemo(() => {
    if (!searchQuery.trim()) return metadata;
    const q = searchQuery.toLowerCase();
    return metadata.filter((item) => item.title?.toLowerCase().includes(q));
  }, [metadata, searchQuery]);

  const handleClose = () => {
    router.replace(pathname, { scroll: false });
  };

  return (
  <>
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
          {/* Hero + Search Section */}
          <div className="relative z-10 flex flex-col items-center text-center pt-24 pb-12 px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full flex flex-col items-center"
            >
              {title && (
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] tracking-tight leading-tight mb-3">
                  {title}
                </h1>
              )}
              <p className="text-white/50 text-base sm:text-lg mb-10">
                {filteredMetadata.length}{" "}
                {filteredMetadata.length === 1
                  ? t("libraryScreen.item")
                  : t("libraryScreen.items")}
              </p>

              {/* Search Bar */}
              <div className="relative w-full max-w-2xl group">
                {/* outer glow ring */}
                <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-white/20 via-white/10 to-white/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none blur-sm" />
                {/* inner container */}
                <div className="relative flex items-center rounded-2xl bg-white/[0.08] border border-white/15 group-focus-within:border-white/30 group-focus-within:bg-white/[0.13] backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] transition-all duration-300 overflow-hidden">
                  <Search className="shrink-0 ml-5 w-5 h-5 text-white/35 group-focus-within:text-white/70 transition-colors duration-200" />
                  <input
                    type="text"
                    placeholder={t("libraryScreen.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-4 bg-transparent text-white placeholder-white/30 text-base font-normal focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="shrink-0 mr-4 w-7 h-7 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white/60 hover:text-white transition-all duration-150"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
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
                const isWatched = (item.viewCount ?? 0) > 0;
                const posterSrc = item.thumb 
                  ? getPosterImage(item.thumb, false, true) 
                  : item.art 
                    ? getCoverImage(item.art, false, true) 
                    : null;

                const navigateToItem = () => {
                  if (isCollection) {
                    router.push(`${pathname}?${qs.stringify({ key: item.key, libtitle: item.title })}`, { scroll: false });
                  } else {
                    router.push(`${pathname}?mid=${item.ratingKey}`, { scroll: false });
                  }
                };

                const menuItems = (
                  <>
                    {/* Watchlist */}
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                      onClick={(e) => handleAddToWatchlist(item, e)}
                    >
                      <BookMarked className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.addToWatchlist")}</span>
                    </button>
                    {/* Share */}
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                      onClick={(e) => handleShare(item, e)}
                    >
                      <Link2 className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.share")}</span>
                    </button>
                    {/* Random */}
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                      onClick={(e) => handleRandom(item, e)}
                    >
                      <Shuffle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.random")}</span>
                    </button>
                    {/* Play next / Queue */}
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                      onClick={(e) => handlePlayNext(item, e)}
                    >
                      <SkipForward className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.playNext")}</span>
                    </button>
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                      onClick={(e) => handleAddToQueue(item, e)}
                    >
                      <ListPlus className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.addToQueue")}</span>
                    </button>
                    {/* View history */}
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                      onClick={(e) => handleViewHistory(item, e)}
                    >
                      <History className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.viewHistory")}</span>
                    </button>
                    {/* Watch toggle */}
                    <button
                      className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                      onClick={(e) => handleMarkWatched(item, e)}
                    >
                      {isWatched
                        ? <><EyeOff className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.markUnwatched")}</span></>
                        : <><Eye className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.markWatched")}</span></>}
                    </button>
                    {isAdmin && (
                      <>
                        <div className="my-1 border-t border-white/10" />
                        <button
                          className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleRefreshMetadata(item, e); }}
                        >
                          <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.refreshMetadata")}</span>
                        </button>
                        <button
                          className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleAnalyze(item, e); }}
                        >
                          <Clapperboard className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.analyze")}</span>
                        </button>
                        {canEditType(item.type) && (
                          <button
                            className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                            onClick={(e) => { e.stopPropagation(); setEditMetadataKey(item.ratingKey); }}
                          >
                            <Pencil className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.fixIdentification")}</span>
                          </button>
                        )}
                        {canEditType(item.type) && (
                          <button
                            className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                            onClick={(e) => { e.stopPropagation(); handleUnmatch(item, e); }}
                          >
                            <X className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.removeIdentification")}</span>
                          </button>
                        )}
                        <button
                          className="w-full flex items-start gap-3 px-3 py-2 text-sm text-white/90 hover:bg-white/10 rounded transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleOptimize(item, e); }}
                        >
                          <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.optimize")}</span>
                        </button>
                        <div className="my-1 border-t border-white/10" />
                        <button
                          className="w-full flex items-start gap-3 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirmItem(item); }}
                        >
                          <Trash2 className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.delete")}</span>
                        </button>
                      </>
                    )}
                  </>
                );
                
                return (
                  <ContextMenu key={i}>
                    <ContextMenuTrigger asChild>
                      <motion.div
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
                          navigateToItem();
                        }}
                        onClick={navigateToItem}
                      >
                        <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-300 hover:shadow-2xl hover:shadow-black/50 bg-white/5">
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
                          {isWatched && (
                            <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {/* Three-dot menu button */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="absolute bottom-2 right-2 z-20 w-7 h-7 rounded-full bg-black/70 hover:bg-black/90 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                              >
                                <MoreVertical className="w-4 h-4 text-white" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-56 p-1.5 bg-zinc-900 border-white/10 text-white shadow-2xl"
                              align="end"
                              side="bottom"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {menuItems}
                            </PopoverContent>
                          </Popover>
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
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-56 bg-zinc-900 border-white/10 text-white shadow-2xl p-1.5">
                      <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleAddToWatchlist(item, e)}>
                        <BookMarked className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.addToWatchlist")}</span>
                      </ContextMenuItem>
                      <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleShare(item, e)}>
                        <Link2 className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.share")}</span>
                      </ContextMenuItem>
                      <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleRandom(item, e)}>
                        <Shuffle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.random")}</span>
                      </ContextMenuItem>
                      <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handlePlayNext(item, e)}>
                        <SkipForward className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.playNext")}</span>
                      </ContextMenuItem>
                      <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleAddToQueue(item, e)}>
                        <ListPlus className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.addToQueue")}</span>
                      </ContextMenuItem>
                      <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleViewHistory(item, e)}>
                        <History className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.viewHistory")}</span>
                      </ContextMenuItem>
                      <ContextMenuSeparator className="bg-white/10" />
                      <ContextMenuItem
                        className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer"
                        onClick={(e) => handleMarkWatched(item, e)}
                      >
                        {isWatched
                          ? <><EyeOff className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.markUnwatched")}</span></>
                          : <><Eye className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.markWatched")}</span></>}
                      </ContextMenuItem>
                      {isAdmin && (
                        <>
                          <ContextMenuSeparator className="bg-white/10" />
                          <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleRefreshMetadata(item, e)}>
                            <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.refreshMetadata")}</span>
                          </ContextMenuItem>
                          <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleAnalyze(item, e)}>
                            <Clapperboard className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.analyze")}</span>
                          </ContextMenuItem>
                          {canEditType(item.type) && (
                            <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={() => setEditMetadataKey(item.ratingKey)}>
                              <Pencil className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.fixIdentification")}</span>
                            </ContextMenuItem>
                          )}
                          {canEditType(item.type) && (
                            <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleUnmatch(item, e)}>
                              <X className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.removeIdentification")}</span>
                            </ContextMenuItem>
                          )}
                          <ContextMenuItem className="flex items-start gap-3 text-sm text-white/90 focus:bg-white/10 focus:text-white cursor-pointer" onClick={(e) => handleOptimize(item, e)}>
                            <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.optimize")}</span>
                          </ContextMenuItem>
                          <ContextMenuSeparator className="bg-white/10" />
                          <ContextMenuItem
                            className="flex items-start gap-3 text-sm text-red-400 focus:bg-red-500/10 focus:text-red-400 cursor-pointer"
                            onClick={() => setDeleteConfirmItem(item)}
                          >
                            <Trash2 className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="flex-1 leading-snug">{t("libraryScreen.contextMenu.delete")}</span>
                          </ContextMenuItem>
                        </>
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
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

    {/* Metadata editor dialog */}
    <MetadataEditorDialog ratingKey={editMetadataKey} onClose={() => setEditMetadataKey(null)} />

    {/* Delete confirmation dialog */}
    <Dialog open={!!deleteConfirmItem} onOpenChange={(open) => { if (!open) setDeleteConfirmItem(null); }}>
      <DialogContent className="max-w-md bg-zinc-950 border-white/15 text-white">
        <DialogTitle className="text-white">{t("libraryScreen.contextMenu.deleteConfirmTitle")}</DialogTitle>
        <DialogDescription className="text-white/70">
          {t("libraryScreen.contextMenu.deleteConfirmDesc")}
        </DialogDescription>
        <div className="flex gap-3 justify-end mt-2">
          <button
            onClick={() => setDeleteConfirmItem(null)}
            className="px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 transition-colors text-sm"
          >
            {t("libraryScreen.contextMenu.cancel")}
          </button>
          <button
            onClick={handleDelete}
            disabled={!!deletingId}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors text-sm disabled:opacity-50"
          >
            {t("libraryScreen.contextMenu.deleteConfirmButton")}
          </button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Play history dialog */}
    <Dialog open={!!historyItem} onOpenChange={(open) => { if (!open) { setHistoryItem(null); setHistoryData(null); } }}>
      <DialogContent className="max-w-md bg-zinc-950 border-white/15 text-white">
        <DialogTitle className="text-white">{t("libraryScreen.contextMenu.historyTitle")}</DialogTitle>
        <DialogDescription className="text-white/70 sr-only">{historyItem?.title}</DialogDescription>
        <div className="mt-2 max-h-72 overflow-y-auto space-y-2">
          {historyData === null && (
            <p className="text-white/50 text-sm">{t("libraryScreen.loadingMore")}</p>
          )}
          {historyData !== null && historyData.length === 0 && (
            <p className="text-white/50 text-sm">{t("libraryScreen.contextMenu.historyEmpty")}</p>
          )}
          {historyData?.map((h, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 text-sm">
              <span className="text-white/90 truncate">{h.title || historyItem?.title}</span>
              <span className="text-white/50 ml-3 flex-shrink-0">
                {new Date(h.viewedAt * 1000).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>

    {/* Toast notification */}
    {toast && (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-full bg-zinc-800 border border-white/10 text-white text-sm font-medium shadow-xl pointer-events-none animate-in fade-in slide-in-from-bottom-4">
        {toast}
      </div>
    )}
  </>
  );
};
