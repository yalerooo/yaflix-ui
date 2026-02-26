import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { PlexConnection, PlexServer } from "@/type";
import { fetchAvailableServers, fetchExistingServer } from "@/lib/server";
import { Api } from "@/api";
import { XMLParser } from "fast-xml-parser";
import qs from "qs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useSettings } from "@/components/settings-provider";

export type LibraryAndServer = {
  libraries: Plex.LibrarySection[];
  server: PlexServer;
  connection: PlexConnection;
};

const Context = createContext(
  {} as {
    servers: PlexServer[];
    server: LibraryAndServer;
    libraries: Plex.LibrarySection[];
    disabledLibraries: { [key in string]: boolean };
    toggleDisableLibrary: (title: string) => void;
    handleServerSelection: (server: LibraryAndServer) => void;
    reorderLibraries: (fromIndex: number, toIndex: number) => void;
    scanLibrary: (libraryKey: string) => Promise<void>;
  },
);

export function ServerProvider({ children }: { children: ReactNode }) {
  const { t } = useSettings();
  const [servers, setServers] = useState<PlexServer[]>([]);
  const [server, setServer] = useState<LibraryAndServer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<boolean>(false);
  const [disabledLibraries, setDisabledLibraries] = useState<{
    [key in string]: boolean;
  }>(JSON.parse(localStorage.getItem("disabledLibraries") ?? "{}"));
  const [libraryOrder, setLibraryOrder] = useState<string[]>(
    JSON.parse(localStorage.getItem("libraryOrder") ?? "[]"),
  );

  useEffect(() => {
    setUser(!!localStorage.getItem("user-uuid"));
    const currentConnectionUri = localStorage.getItem("server") ?? "";
    let controllers: AbortController[] = [];
    setLoading(true);
    setError(null);
    fetchExistingServer(currentConnectionUri)
      .then((currentInfo) => {
        if (currentInfo) {
          localStorage.setItem("server", currentInfo.connection.uri);
          localStorage.setItem("token", currentInfo.server.accessToken);
          setServer(currentInfo);
        }
        return fetchAvailableServers();
      })
      .then(({ list, info, controllers: aborts }) => {
        if (aborts) controllers = aborts;
        if (list.length === 0) {
          setError(t("server.noServersFound"));
          return;
        }
        if (!server && info) {
          localStorage.setItem("token", info.server.accessToken);
          localStorage.setItem("server", info.connection.uri);
          setServer(info);
        }
        setServers(list);
      })
      .catch((err) => {
        console.error(err);
        if (err.message?.includes('No se ha podido conectar')) {
          setError(err.message);
        } else {
          setError(t("server.connectError"));
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      controllers.forEach((controller) => controller.abort());
    };
  }, []);

  const toggleDisableLibrary = (title: string) => {
    const updated = { ...disabledLibraries };
    updated[title] = !updated[title];
    setDisabledLibraries(updated);
    localStorage.setItem("disabledLibraries", JSON.stringify(updated));
  };

  const handleServerSelection = (server: LibraryAndServer) => {
    setServer(server);
    localStorage.setItem("server", server.connection.uri);
    localStorage.setItem("token", server.server.accessToken);
    window.location.reload();
  };

  const reorderLibraries = (fromIndex: number, toIndex: number) => {
    const currentLibraries = getOrderedLibraries();
    const newOrder = [...currentLibraries];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    const newOrderKeys = newOrder.map((lib) => lib.key);
    setLibraryOrder(newOrderKeys);
    localStorage.setItem("libraryOrder", JSON.stringify(newOrderKeys));
  };

  const scanLibrary = async (libraryKey: string) => {
    const token = localStorage.getItem("token");
    const serverUrl = localStorage.getItem("server");
    if (!token || !serverUrl) return;
    
    try {
      await fetch(
        `${serverUrl}/library/sections/${libraryKey}/refresh?X-Plex-Token=${token}`,
        { method: "GET" }
      );
    } catch (error) {
      console.error(t("server.scanLibraryError"), error);
    }
  };

  const getOrderedLibraries = (): Plex.LibrarySection[] => {
    if (!server?.libraries) return [];
    
    if (libraryOrder.length === 0) {
      return server.libraries;
    }
    
    const ordered: Plex.LibrarySection[] = [];
    const libraryMap = new Map(
      server.libraries.map((lib) => [lib.key, lib])
    );
    
    // Add libraries in saved order
    libraryOrder.forEach((key) => {
      const lib = libraryMap.get(key);
      if (lib) {
        ordered.push(lib);
        libraryMap.delete(key);
      }
    });
    
    // Add any new libraries that aren't in the saved order
    libraryMap.forEach((lib) => ordered.push(lib));
    
    return ordered;
  };

  if (loading || !server) {
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6">
          <div className="glass rounded-2xl p-8 max-w-md text-center space-y-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto text-red-500"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2 className="text-xl font-semibold text-white">
              {t("server.connectionErrorTitle")}
            </h2>
            <p className="text-white/80">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-6 py-2 bg-plex hover:bg-plex/80 text-white rounded-full font-semibold transition-colors"
            >
              {t("server.retry")}
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  if (!user) {
    return <UserSelect />;
  }

  return (
    <Context.Provider
      value={{
        servers,
        server,
        libraries: getOrderedLibraries(),
        disabledLibraries,
        toggleDisableLibrary,
        handleServerSelection,
        reorderLibraries,
        scanLibrary,
      }}
    >
      {children}
    </Context.Provider>
  );
}

function mapUser(
  rec: Record<string, unknown>,
): Pick<Plex.UserData, "uuid" | "title" | "thumb" | "hasPassword"> {
  const token = localStorage.getItem("token");
  const server = localStorage.getItem("server");
  return {
    uuid: rec["@_uuid"] as string,
    hasPassword: rec["@_protected"] == 1,
    thumb: `${server}/photo/:/transcode?${qs.stringify({
      width: 128,
      height: 128,
      url: rec["@_thumb"],
      minSize: 1,
      "X-Plex-Token": token,
    })}`,
    title: rec["@_title"] as string,
  };
}

function UserSelect() {
  const { t } = useSettings();
  const [users, setUsers] = useState<
    Pick<Plex.UserData, "uuid" | "title" | "thumb" | "hasPassword">[]
  >([]);
  const [viewPassword, setViewPassword] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = ({
    uuid,
    pin = undefined,
  }: {
    uuid: string;
    pin?: string;
  }) => {
    setLoading(true);
    Api.switch({ uuid, pin })
      .then((res) => {
        localStorage.setItem("user-uuid", uuid);
        localStorage.setItem("uuid", uuid);
        localStorage.setItem("token", res.data.authToken);
        localStorage.setItem("auth-token", res.data.authToken);
        window.location.reload();
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    Api.users().then((res) => {
      // console.log(res);
      const parser = new XMLParser({
        parseAttributeValue: true,
        ignoreAttributes: false,
      });
      const obj = parser.parse(res.data);
      const mappedUsers: Pick<
        Plex.UserData,
        "uuid" | "title" | "thumb" | "hasPassword"
      >[] = Array.isArray(obj.MediaContainer.User)
        ? (obj.MediaContainer.User as Record<string, unknown>[]).map(mapUser)
        : [mapUser(obj.MediaContainer.User as Record<string, unknown>)];
      setUsers(() => mappedUsers);
    });
  }, []);

  return (
    <div className="min-h-[70vh] px-6 py-10 sm:px-10 md:px-16 flex flex-col items-center justify-center gap-8">
      <div className="text-center space-y-1">
        <p className="font-semibold text-2xl sm:text-3xl tracking-tight">
          {t("userSelect.title")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("userSelect.subtitle")}
        </p>
      </div>

      <div className="w-full max-w-6xl flex flex-wrap justify-center gap-4 sm:gap-6">
        {users.map((user, index) => (
          <div
            key={user.uuid}
            className={cn(
              "group w-[160px] sm:w-[180px] rounded-2xl border bg-muted/30 transition-all",
              "hover:border-primary/80 hover:bg-muted/50 hover:text-primary hover:scale-[1.03]",
              "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30",
              viewPassword === index && "border-primary/80 bg-muted/50",
            )}
          >
            <button
              onClick={() => {
                if (user.hasPassword) {
                  setViewPassword((prev) => (prev === index ? null : index));
                } else {
                  handleSubmit({ uuid: user.uuid });
                }
              }}
              className="w-full flex flex-col items-center justify-center gap-3 p-4 sm:p-5 text-center disabled:text-muted-foreground"
              disabled={loading}
            >
              <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-2 ring-background shadow-sm transition-transform group-hover:scale-105">
                <AvatarImage src={user.thumb} />
                <AvatarFallback>
                  {user.title.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold leading-tight line-clamp-2 min-h-[2.5rem] flex items-center">
                {user.title}
              </p>
            </button>

            {viewPassword === index && (
              <form
                id="form-element"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = Object.fromEntries(
                    new FormData(e.target as HTMLFormElement),
                  ) as unknown as {
                    userPin: string;
                  };
                  handleSubmit({ uuid: user.uuid, pin: data.userPin });
                }}
                className={cn(
                  "px-3 pb-4 sm:px-4 sm:pb-5 overflow-hidden flex justify-center",
                )}
              >
                <InputOTP
                  maxLength={4}
                  pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                  autoFocus
                  required
                  id="password-input"
                  name="userPin"
                  onChange={(value) => {
                    if (value.length === 4) {
                      handleSubmit({ uuid: user.uuid, pin: value });
                    }
                  }}
                  disabled={loading}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function useServer() {
  return useContext(Context);
}
