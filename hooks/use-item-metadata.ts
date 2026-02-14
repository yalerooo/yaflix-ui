import { ServerApi } from "@/api";
import { useQuery } from "@tanstack/react-query";

const useItemMetadata = (mid: string | null | undefined) => {
  const metadata = useQuery({
    queryKey: ["metadata", mid],
    queryFn: async () => {
      if (!mid) return null;
      return ServerApi.metadata({ id: mid });
    },
  });

  return { metadata: metadata.data, loading: metadata.isLoading };
};

const useItemChildren = (
  item?: Plex.Metadata | Plex.HubMetadata | Plex.Child | null | undefined,
) => {
  const metadata = useQuery({
    queryKey: ["metadata", "children", item?.ratingKey],
    queryFn: async () => {
      if (!item) return null;
      if (!item.ratingKey) return null;
      if (item.type === "season" || item.type === "show") {
        return ServerApi.children({ id: item.ratingKey });
      }
      if (item.type === "episode" && item.parentRatingKey) {
        return ServerApi.children({ id: item.parentRatingKey });
      }
      return null;
    },
  });

  return { children: metadata.data, loading: metadata.isLoading };
};

const useRelated = (
  item?: Plex.Metadata | Plex.HubMetadata | null | undefined,
) => {
  const metadata = useQuery({
    queryKey: ["related", item],
    queryFn: async () => {
      if (!item) return [];
      let id = item.ratingKey;
      if (item.type === "season" && item.parentRatingKey) {
        id = item.parentRatingKey;
      } else if (item.type === "episode" && item.grandparentRatingKey) {
        id = item.grandparentRatingKey;
      }
      return await ServerApi.related({ id });
    },
  });

  return { related: metadata.data, loading: metadata.isLoading };
};

export { useItemMetadata, useItemChildren, useRelated };
