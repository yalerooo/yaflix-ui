import { useEffect, useState } from "react";
import axios from "axios";
import qs from "qs";
import { xprops } from "@/api";
import { uuid } from "@/lib/utils";

export const useHubs = (initialHubs: Plex.Hub[] | null) => {
  const [hubs, setHubs] = useState<Plex.Hub[] | null>(null);
  const token = localStorage.getItem("token");
  const server = localStorage.getItem("server");

  useEffect(() => {
    if (!initialHubs) return;
    setHubs(initialHubs);
  }, [initialHubs]);

  const append = (hubIndex: number, updatedMetadata: Plex.HubMetadata[]) => {
    if (!hubs) return;
    if (hubIndex < 0 || hubIndex >= hubs.length) return;
    setHubs((prev) => {
      if (!prev) return null;
      const temp = [...prev];
      temp[hubIndex] = {
        ...temp[hubIndex],
        Metadata: temp[hubIndex]?.Metadata
          ? temp[hubIndex].Metadata.reduce(
              (acc, item) =>
                acc.concat([
                  updatedMetadata.find((i) => i.ratingKey === item.ratingKey) ??
                    item,
                ]),
              [] as Plex.HubMetadata[],
            ).concat(
              updatedMetadata.filter(
                (item) =>
                  !temp[hubIndex].Metadata!.some(
                    (i) => i.ratingKey === item.ratingKey,
                  ),
              ),
            )
          : updatedMetadata,
      };
      return temp;
    });
  };

  const reload = (hubIndex: number) => {
    if (!hubs) return;
    if (hubIndex < 0 || hubIndex >= hubs.length) return;
    const hub = hubs[hubIndex];
    const decodedKey = decodeURIComponent(hub.key);
    axios
      .get<{ MediaContainer: { Metadata: Plex.HubMetadata[] } }>(
        `${server}${decodedKey}${decodedKey.includes("?") ? "&" : "?"}${qs.stringify(
          {
            ...xprops(),
            excludeFields: "summary",
            "X-Plex-Container-Start": 0,
            "X-Plex-Container-Size": hub.Metadata?.length ?? 50,
            uuid: uuid(),
          },
        )}`,
        { headers: { "X-Plex-Token": token, accept: "application/json" } },
      )
      .then((res) => {
        setHubs((prev) => {
          if (!prev) return null;
          const temp = [...prev];
          temp[hubIndex] = {
            ...temp[hubIndex],
            Metadata: res.data.MediaContainer.Metadata,
          };
          return temp;
        });
      })
      .catch(console.error);
  };

  return { reload, hubs, append };
};
