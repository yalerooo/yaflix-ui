export interface VideoItemInterface
  extends Pick<
    Plex.Metadata,
    | "title"
    | "type"
    | "grandparentTitle"
    | "year"
    | "leafCount"
    | "viewedLeafCount"
    | "viewCount"
    | "childCount"
    | "rating"
    | "contentRating"
    | "duration"
    | "grandparentRatingKey"
    | "ratingKey"
    | "summary"
    | "viewOffset"
    | "parentTitle"
    | "OnDeck"
    | "Children"
    | "index"
    | "parentIndex"
  > {
  image: string;
}

export interface PlexConnection {
  protocol: string;
  address: string;
  port: number;
  uri: string;
  local: boolean;
  relay: boolean;
  IPv6: boolean;
}

export interface PlexServer {
  name: string;
  product: string;
  productVersion: string;
  platform: string;
  platformVersion: string;
  device: string;
  clientIdentifier: string;
  createdAt: string;
  lastSeenAt: string;
  provides: string;
  ownerId: any;
  sourceTitle: any;
  publicAddress: string;
  accessToken: string;
  owned: boolean;
  home: boolean;
  synced: boolean;
  relay: boolean;
  presence: boolean;
  httpsRequired: boolean;
  publicAddressMatches: boolean;
  dnsRebindingProtection: boolean;
  natLoopbackSupported: boolean;
  connections: PlexConnection[];
}
