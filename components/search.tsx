import { SearchIcon } from "lucide-react";
import { useSearch } from "@/components/search-provider";
import { useSettings } from "@/components/settings-provider";

export const Search = () => {
  const { onOpen } = useSearch();
  const { t } = useSettings();

  return (
    <button
      type="button"
      className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-4 py-2 hover:bg-white/20 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-lg text-sm font-semibold text-white/90 hover:text-white flex items-center gap-2 w-full justify-between"
      onClick={() => onOpen(true)}
    >
      <div className="flex flex-row gap-2 items-center">
        <SearchIcon className="w-4 h-4" />
        <span>{t("search.openLibraries")}</span>
      </div>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-white/20 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-white/50">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
};
