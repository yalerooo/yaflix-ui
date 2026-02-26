"use client";

import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronsLeftRightEllipsis,
  Film,
  House,
  LogOut,
  Menu,
  Server,
  SettingsIcon,
  TvMinimal,
  X,
} from "lucide-react";
import { Search } from "@/components/search";
import { useIsAtTop } from "@/hooks/use-is-at-top";
import { cn } from "@/lib/utils";
import { useServer } from "@/components/server-provider";
import { ChangeServerDialog } from "@/components/change-server-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import qs from "qs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import he from "he";
import { useSettings } from "@/components/settings-provider";

export const APPBAR_HEIGHT = "4.5rem";

export const Appbar = () => {
  const path = usePathname();
  const router = useRouter();
  const { user } = useSession();
  const { libraries, disabledLibraries } = useServer();
  const { t } = useSettings();

  const isAtTop = useIsAtTop();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth-token");
    localStorage.removeItem("uuid");
    localStorage.removeItem("pin");
    localStorage.removeItem("user-uuid");
    window.location.href = "/";
  };

  return (
    <>
      <div
        className={cn(
          `flex justify-center items-center fixed top-0 h-[${APPBAR_HEIGHT}] w-full z-[45] transition duration-500 py-4`,
        )}
      >
        <div className="flex items-center gap-3">
          {/* Navigation Links - Glassmorphic Capsules */}
          <nav className="hidden md:flex items-center gap-3">
            <Link
              href="/"
              className={cn(
                "backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg",
                path === "/" ? "text-white bg-white/20" : "text-white/90"
              )}
            >
              {t("appbar.home")}
            </Link>
            {libraries.map((section) =>
              !disabledLibraries[section.title] ? (
                <Popover key={section.key}>
                  <PopoverTrigger className={cn(
                    "backdrop-blur-lg bg-white/10 border border-white/20 rounded-full px-6 py-2 hover:text-white hover:bg-white/20 font-semibold text-sm transition-all duration-200 shadow-lg",
                    path.includes(`/browse/${section.key}`) ? "text-white bg-white/20" : "text-white/90"
                  )}>
                    {section.title}
                  </PopoverTrigger>
                  <PopoverContent side="bottom" className="w-48 p-3 backdrop-blur-lg bg-black/40 border border-white/20 shadow-2xl">
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={() => {
                          router.push(
                            `${path}?${qs.stringify({ key: `/library/sections/${section.key}/all?sort=titleSort`, libtitle: `${section.title} Library` })}`,
                            {
                              scroll: false,
                            },
                          );
                        }}
                        variant="ghost"
                        className="justify-start font-semibold text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200"
                        size="sm"
                      >
                        {t("appbar.library")}
                      </Button>
                      <Button
                        onClick={() => router.push(`/browse/${section.key}`)}
                        variant="ghost"
                        className="justify-start font-semibold text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200"
                        size="sm"
                      >
                        {t("appbar.browse")}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null,
            )}
          </nav>
          
          {/* Mobile Menu Button */}
          <Sheet>
            <SheetTrigger className="block md:hidden backdrop-blur-lg bg-white/10 border border-white/20 rounded-full p-2 text-white hover:bg-white/20 transition-all duration-200 shadow-lg">
              <Menu />
            </SheetTrigger>
          <SheetContent side="left" className="max-w-[300px]">
            <SheetHeader className="pb-4 flex flex-row justify-between items-center space-y-0">
              <SheetTitle>Yaflix</SheetTitle>
              <SheetClose asChild>
                <Button variant="search" size="icon">
                  <X />
                </Button>
              </SheetClose>
            </SheetHeader>
            <div className="flex flex-col gap-4">
              <Button
                variant="search"
                asChild
                className="justify-start data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                <Link
                  href="/"
                  data-state={path === "/" ? "active" : "inactive"}
                >
                  <House />
                  {t("appbar.home")}
                </Link>
              </Button>
              {libraries.map((section) =>
                !disabledLibraries[section.title] ? (
                  <Button
                    key={section.key}
                    variant="search"
                    asChild
                    className="justify-start data-[state=active]:border-primary data-[state=active]:text-primary"
                  >
                    <Link
                      href={`/browse/${section.key}`}
                      data-state={
                        path.includes(`/browse/${section.key}`)
                          ? "active"
                          : "inactive"
                      }
                    >
                      {section.type === "movie" && <Film size={20} />}
                      {section.type === "show" && <TvMinimal size={20} />}
                      {section.title}
                    </Link>
                  </Button>
                ) : null,
              )}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* User Avatar */}
        {user && (
          <Popover>
            <PopoverTrigger className="backdrop-blur-lg bg-white/10 border border-white/20 rounded-full p-1 hover:bg-white/20 transition-all duration-200 shadow-lg">
              <Avatar>
                <AvatarImage src={user.thumb} />
                <AvatarFallback>
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </PopoverTrigger>
            <PopoverContent side="bottom" className="m-4 backdrop-blur-lg bg-black/40 border border-white/20 shadow-2xl">
              <div className="flex flex-col gap-4">
                <div className="flex gap-2 items-center bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/10 hover:border-white/20 overflow-hidden transition-all duration-200">
                  <div>
                    <Avatar>
                      <AvatarImage src={user.thumb} />
                      <AvatarFallback>
                        {user.title.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div>
                    <p className="font-semibold line-clamp-1 text-white">
                      {he.decode(user.title)}
                    </p>
                    {user.email && (
                      <p className="font-medium truncate leading-tight text-xs text-white/60">
                        {user.email}
                      </p>
                    )}
                  </div>
                </div>
                <Search />
                <Button
                  className="justify-start px-2 font-bold text-white/90 hover:text-white hover:bg-white/10"
                  size="sm"
                  type="button"
                  asChild
                  variant="ghost"
                >
                  <Link href="/settings">
                    <SettingsIcon /> <span>{t("appbar.settings")}</span>
                  </Link>
                </Button>
                {user && (
                  <>
                    <ChangeServerDialog
                      trigger={
                        <Button
                          className="justify-start px-2 font-bold text-white/90 hover:text-white hover:bg-white/10"
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          <Server /> <span>{t("appbar.changeServer")}</span>
                        </Button>
                      }
                    />
                    <Button
                      className="justify-start px-2 font-bold text-white/90 hover:text-white hover:bg-white/10"
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        localStorage.removeItem("user-uuid");
                        window.location.reload();
                      }}
                    >
                      <ChevronsLeftRightEllipsis /> <span>{t("appbar.changeUser")}</span>
                    </Button>
                    <Button
                      className="justify-start px-2 font-bold text-white/90 hover:text-white hover:bg-white/10"
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={handleLogout}
                    >
                      <LogOut /> <span>{t("appbar.logout")}</span>
                    </Button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
        </div>
      </div>
    </>
  );
};
