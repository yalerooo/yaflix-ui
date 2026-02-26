import { Button } from "@/components/ui/button";
import { SearchIcon } from "lucide-react";
import { useSearch } from "@/components/search-provider";
import { useSettings } from "@/components/settings-provider";

export const Search = () => {
  const { onOpen } = useSearch();
  const { t } = useSettings();

  return (
    <Button
      size="sm"
      className="transition text-left justify-between px-2 gap-2"
      onClick={() => onOpen(true)}
    >
      <div className="flex flex-row gap-2">
        <SearchIcon />
        <p>{t("search.openLibraries")}</p>
      </div>
      <kbd className="group-hover:text-primary transition pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );
};
