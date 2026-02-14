import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Server } from "lucide-react";
import { DialogBody } from "next/dist/client/components/react-dev-overlay/internal/components/Dialog";
import { PlexConnection, PlexServer } from "@/type";
import { LibraryAndServer, useServer } from "@/components/server-provider";
import { ReactNode, useEffect, useState } from "react";
import { fetchConnectionLibrary } from "@/lib/server";
import { cn } from "@/lib/utils";

// helper function to format the connection URL for display
const formatConnectionUrl = (connection: PlexConnection) => {
  try {
    const url = new URL(connection.uri);
    return `${url.hostname}`;
  } catch (e) {
    return connection.uri;
  }
};

// helper function to sort and filter connections
const getPreferredConnections = (
  connections: PlexConnection[],
  userIp = undefined,
) => {
  // First, separate connections by type
  const local = connections.filter((c) => c.local && !c.relay);
  const remote = connections.filter((c) => !c.local && !c.relay);
  const relay = connections.filter((c) => c.relay);

  // Filter local connections to only include those that match the user's IP
  // const userLocal = local.filter((c) => userIp && c.address === userIp);

  // For each type, prioritize HTTPS over HTTP
  const sortByProtocol = (conns: PlexConnection[]) => {
    return conns.sort((a, b) => {
      if (a.protocol === "https" && b.protocol !== "https") return -1;
      if (a.protocol !== "https" && b.protocol === "https") return 1;
      return 0;
    });
  };

  // Combine in priority order: userLocal -> remote -> relay
  // Only include relay if no other options are available
  const preferred = [...sortByProtocol(local), ...sortByProtocol(remote)];
  return preferred.length > 0 ? preferred : sortByProtocol(relay);
};

function ConnectionButton({
  server,
  connection,
  selected,
  onSelect,
}: {
  server: PlexServer;
  connection: PlexConnection;
  selected: LibraryAndServer;
  onSelect: (info: LibraryAndServer) => void;
}) {
  const [status, setStatus] = useState<"loading" | "success" | "fail">(
    "loading",
  );
  const [libraries, setLibraries] = useState<Plex.LibrarySection[]>([]);

  useEffect(() => {
    fetchConnectionLibrary({ connection, server }).then((info) => {
      if (info) {
        setStatus("success");
        setLibraries(info.libraries);
      } else {
        setStatus("fail");
      }
    });
  }, []);

  return (
    <Button
      variant="outline"
      className={cn(
        "justify-start font-normal w-full",
        selected.connection.uri === connection.uri && "border-primary",
      )}
      onClick={() => onSelect({ server, connection, libraries })}
      disabled={status !== "success"}
    >
      <p className="truncate">
        {formatConnectionUrl(connection)}
        {connection.local && " (local)"}
        {connection.relay && " (relay)"}
      </p>
    </Button>
  );
}

export function ChangeServerDialog({ trigger }: { trigger: ReactNode }) {
  const { servers, server, handleServerSelection } = useServer();
  const [selected, setSelected] = useState<LibraryAndServer>(server);
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Server</DialogTitle>
          <DialogDescription>
            Choose a plex server to connect to.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="overflow-hidden space-y-2">
          {servers.map((info) => {
            const connections = getPreferredConnections(info.connections);

            if (connections.length === 0) return null;
            return (
              <div key={info.clientIdentifier} className="space-y-2">
                <div className="font-semibold text-sm text-muted-foreground">
                  {info.name}
                </div>
                {connections.map((connection) => (
                  <ConnectionButton
                    key={connection.uri}
                    server={info}
                    selected={selected}
                    connection={connection}
                    onSelect={setSelected}
                  />
                ))}
              </div>
            );
          })}
        </DialogBody>
        <DialogFooter>
          <Button
            onClick={() => {
              handleServerSelection(selected);
            }}
            disabled={selected.connection.uri === server.connection.uri}
          >
            Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
