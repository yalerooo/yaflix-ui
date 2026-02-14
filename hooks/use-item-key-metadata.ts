import { useCallback, useEffect, useRef, useState } from "react";
import axios, { Canceler } from "axios";
import qs from "qs";
import { xprops } from "@/api";

const useItemKeyMetadata = (
  key: string | null | undefined,
  contentDirectoryID: string | null | undefined,
) => {
  const [metadata, setMetadata] = useState<Plex.Metadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [page, setPage] = useState(0);
  const observer = useRef<IntersectionObserver>();
  const lastRef = useCallback(
    (node: HTMLDivElement | HTMLButtonElement) => {
      if (loading || !hasMore) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setPage((p) => p + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore],
  );

  useEffect(() => {
    setMetadata([]);
    setHasMore(true);
    setPage(0);
    setLoading(false);
  }, [key]);

  useEffect(() => {
    if (!key) {
      setMetadata([]);
      setHasMore(true);
      setPage(0);
      setLoading(false);
      return;
    }

    if (!hasMore) {
      return;
    }
    setLoading(true);

    let cancel: Canceler;
    axios
      .get<{
        MediaContainer: { Metadata: Plex.Metadata[]; totalSize: number };
      }>(
        `${localStorage.getItem("server")}${decodeURIComponent(key)}${decodeURIComponent(key).includes("?") ? "&" : "?"}${qs.stringify(
          {
            ...xprops(),
            ...(contentDirectoryID ? { contentDirectoryID } : {}),
            includeCollections: 1,
            includeExternalMedia: 1,
            includeAdvanced: 1,
            includeMeta: 1,
            "X-Plex-Container-Start": metadata.length,
            "X-Plex-Container-Size": 50,
          },
        )}`,
        {
          headers: {
            "X-Plex-Token": localStorage.getItem("token") as string,
            accept: "application/json",
          },
          cancelToken: new axios.CancelToken((c) => {
            cancel = c;
          }),
        },
      )
      .then((res) => {
        if (res.data?.MediaContainer?.Metadata) {
          if (
            res.data.MediaContainer.Metadata.length + metadata.length >=
            res.data.MediaContainer.totalSize
          ) {
            setHasMore(false);
          }
          setMetadata((prev) => [...prev, ...res.data.MediaContainer.Metadata]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setHasMore(true);
        setPage(0);
        setMetadata([]);
        setLoading(false);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      if (cancel) {
        cancel();
        setLoading(false);
      }
    };
  }, [page, key]);

  return { metadata, loading, lastRef };
};

export { useItemKeyMetadata };
