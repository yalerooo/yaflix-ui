"use client";

import { FC, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ServerApi } from "@/api";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItemMetadata } from "@/hooks/use-item-metadata";
import { useQueryClient } from "@tanstack/react-query";
import { useSettings } from "@/components/settings-provider";
import {
  extractTmdbId,
  extractTmdbIdFromGuids,
  extractTvdbId,
  extractTvdbIdFromGuids,
  fetchMovieArtwork,
  fetchTvShowArtwork,
} from "@/lib/fanart";

const SuggestionStrip: FC<{
  title: string;
  items: string[];
  onSelect: (value: string) => void;
}> = ({ title, items, onSelect }) => {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs text-white/70">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {items.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => onSelect(url)}
            className="shrink-0 rounded border border-white/20 overflow-hidden hover:border-plex transition-colors"
            title="Usar imagen"
          >
            <img
              src={url}
              alt={title}
              className="w-24 h-14 object-cover bg-black/40"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    </div>
  );
};

export const MetadataEditorDialog: FC<{
  ratingKey: string | null;
  onClose: () => void;
}> = ({ ratingKey, onClose }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useSettings();

  const { metadata } = useItemMetadata(ratingKey ?? undefined);

  const [form, setForm] = useState({
    title: "",
    titleSort: "",
    originalTitle: "",
    summary: "",
    tagline: "",
    studio: "",
    originallyAvailableAt: "",
    contentRating: "",
    year: "",
    index: "",
    parentIndex: "",
    posterUrl: "",
    artUrl: "",
    thumbUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isImageEditorOpen, setImageEditorOpen] = useState(false);
  const [savingImages, setSavingImages] = useState(false);
  const [imageSaveError, setImageSaveError] = useState<string | null>(null);
  const [loadingImageSuggestions, setLoadingImageSuggestions] = useState(false);
  const [imageSuggestions, setImageSuggestions] = useState<{
    poster: string[];
    art: string[];
    thumb: string[];
  }>({ poster: [], art: [], thumb: [] });

  // Populate form when metadata loads
  useEffect(() => {
    if (!metadata) return;
    setForm({
      title: metadata.title ?? "",
      titleSort: metadata.titleSort ?? "",
      originalTitle: (metadata as Plex.Metadata & { originalTitle?: string }).originalTitle ?? "",
      summary: metadata.summary ?? "",
      tagline: (metadata as Plex.Metadata & { tagline?: string }).tagline ?? "",
      studio: (metadata as Plex.Metadata & { studio?: string }).studio ?? "",
      originallyAvailableAt: (metadata as Plex.Metadata & { originallyAvailableAt?: string }).originallyAvailableAt ?? "",
      contentRating: metadata.contentRating ?? "",
      year: metadata.year ? String(metadata.year) : "",
      index: metadata.index !== undefined ? String(metadata.index) : "",
      parentIndex: metadata.parentIndex !== undefined ? String(metadata.parentIndex) : "",
      posterUrl: "",
      artUrl: "",
      thumbUrl: "",
    });
  }, [metadata]);

  // Load image suggestions when image editor opens
  useEffect(() => {
    if (!isImageEditorOpen || !metadata) return;
    let cancelled = false;
    const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));
    const sortByLikes = (a: { likes: string }, b: { likes: string }) =>
      parseInt(b.likes || "0", 10) - parseInt(a.likes || "0", 10);

    const loadSuggestions = async () => {
      setLoadingImageSuggestions(true);
      setImageSuggestions({ poster: [], art: [], thumb: [] });

      let target: Plex.Metadata | null = metadata;
      if (metadata.type === "season" && metadata.parentRatingKey) {
        target = await ServerApi.metadata({ id: metadata.parentRatingKey });
      } else if (metadata.type === "episode" && metadata.grandparentRatingKey) {
        target = await ServerApi.metadata({ id: metadata.grandparentRatingKey });
      }
      if (!target || cancelled) { setLoadingImageSuggestions(false); return; }

      let poster: string[] = [];
      let art: string[] = [];
      let thumb: string[] = [];

      if (target.type === "show") {
        const guids = (target as Plex.Metadata & { Guid?: Array<{ id: string }> }).Guid;
        let tvdbId = extractTvdbIdFromGuids(guids);
        if (!tvdbId) tvdbId = extractTvdbId(target.guid);
        if (tvdbId) {
          const artwork = await fetchTvShowArtwork(tvdbId);
          if (artwork) {
            poster = unique([...(artwork.tvposter ?? []), ...(artwork.seasonposter ?? [])].sort(sortByLikes).map((img) => img.url));
            art = unique((artwork.showbackground ?? []).sort(sortByLikes).map((img) => img.url));
            thumb = unique([...(artwork.tvthumb ?? []), ...(artwork.seasonthumb ?? [])].sort(sortByLikes).map((img) => img.url));
          }
        }
      } else if (target.type === "movie") {
        const guids = (target as Plex.Metadata & { Guid?: Array<{ id: string }> }).Guid;
        let tmdbId = extractTmdbIdFromGuids(guids);
        if (!tmdbId) tmdbId = extractTmdbId(target.guid);
        if (tmdbId) {
          const artwork = await fetchMovieArtwork(tmdbId);
          if (artwork) {
            poster = unique((artwork.movieposter ?? []).sort(sortByLikes).map((img) => img.url));
            art = unique((artwork.moviebackground ?? []).sort(sortByLikes).map((img) => img.url));
            thumb = unique((artwork.moviethumb ?? []).sort(sortByLikes).map((img) => img.url));
          }
        }
      }

      if (cancelled) return;
      setImageSuggestions({ poster: poster.slice(0, 20), art: art.slice(0, 20), thumb: thumb.slice(0, 20) });
      setLoadingImageSuggestions(false);
    };
    loadSuggestions();
    return () => { cancelled = true; };
  }, [isImageEditorOpen, metadata]);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!metadata) return;
    setSaving(true);
    setSaveError(null);

    const parsedYear = form.year.trim() ? Number(form.year.trim()) : undefined;
    const parsedIndex = form.index.trim() ? Number(form.index.trim()) : undefined;
    const parsedParentIndex = form.parentIndex.trim() ? Number(form.parentIndex.trim()) : undefined;

    if (parsedYear !== undefined && Number.isNaN(parsedYear)) {
      setSaveError("El año debe ser un número válido."); setSaving(false); return;
    }
    if (parsedIndex !== undefined && Number.isNaN(parsedIndex)) {
      setSaveError("El número de episodio/temporada debe ser válido."); setSaving(false); return;
    }
    if (parsedParentIndex !== undefined && Number.isNaN(parsedParentIndex)) {
      setSaveError("El número de temporada debe ser válido."); setSaving(false); return;
    }
    if (form.originallyAvailableAt.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.originallyAvailableAt.trim())) {
      setSaveError("La fecha debe estar en formato YYYY-MM-DD."); setSaving(false); return;
    }

    const saved = await ServerApi.updateMetadata({
      ratingKey: metadata.ratingKey,
      librarySectionID: metadata.librarySectionID,
      type: metadata.type,
      title: form.title.trim(),
      titleSort: form.titleSort.trim(),
      originalTitle: form.originalTitle.trim(),
      summary: form.summary.trim(),
      tagline: form.tagline.trim(),
      studio: form.studio.trim(),
      originallyAvailableAt: form.originallyAvailableAt.trim(),
      contentRating: form.contentRating.trim(),
      year: parsedYear,
      ...(metadata.type === "season" || metadata.type === "episode" ? { index: parsedIndex } : {}),
      ...(metadata.type === "episode" ? { parentIndex: parsedParentIndex } : {}),
    });

    setSaving(false);

    if (!saved) {
      setSaveError("No se pudo guardar. Verifica permisos de administrador en Plex.");
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["metadata"] }),
      queryClient.invalidateQueries({ queryKey: ["related"] }),
    ]);
    router.refresh();
    onClose();
  };

  const handleSaveImages = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!metadata) return;
    setSavingImages(true);
    setImageSaveError(null);

    const imageUrls = [form.posterUrl.trim(), form.artUrl.trim(), form.thumbUrl.trim()].filter(Boolean);
    if (imageUrls.length === 0) {
      setImageSaveError("Agrega al menos una URL de imagen."); setSavingImages(false); return;
    }
    const hasInvalidUrl = imageUrls.some((v) => {
      try { const u = new URL(v); return !(u.protocol === "http:" || u.protocol === "https:"); }
      catch { return true; }
    });
    if (hasInvalidUrl) {
      setImageSaveError("Las imágenes deben ser URLs válidas (http/https)."); setSavingImages(false); return;
    }

    const saved = await ServerApi.updateMetadataImages({
      ratingKey: metadata.ratingKey,
      posterUrl: form.posterUrl,
      artUrl: form.artUrl,
      thumbUrl: form.thumbUrl,
    });

    setSavingImages(false);
    if (!saved) { setImageSaveError("No se pudieron actualizar las imágenes."); return; }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["metadata"] }),
      queryClient.invalidateQueries({ queryKey: ["related"] }),
    ]);
    router.refresh();
    setImageEditorOpen(false);
  };

  const isOpen = !!ratingKey;

  return (
    <>
      <Dialog open={isOpen && !isImageEditorOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl bg-zinc-950 border-white/15 text-white">
          <DialogTitle>{t("metaYaflix.metadataDialogTitle")}</DialogTitle>
          <DialogDescription className="text-white/70">
            {t("metaYaflix.metadataDialogDescription", {
              type: metadata?.type
                ? t(`common.${metadata.type}`, undefined, metadata.type)
                : t("metaYaflix.contentFallbackType"),
            })}
          </DialogDescription>
          <form className="space-y-4" onSubmit={handleSave}>
            <div className="space-y-2">
              <label className="text-sm text-white/80">{t("metaYaflix.title")}</label>
              <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/80">{t("metaYaflix.sortTitle")}</label>
                <Input value={form.titleSort} onChange={(e) => setForm((p) => ({ ...p, titleSort: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/80">{t("metaYaflix.originalTitle")}</label>
                <Input value={form.originalTitle} onChange={(e) => setForm((p) => ({ ...p, originalTitle: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/80">{t("metaYaflix.summary")}</label>
              <textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} rows={4} className="w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-sm text-white" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/80">{t("metaYaflix.tagline")}</label>
                <Input value={form.tagline} onChange={(e) => setForm((p) => ({ ...p, tagline: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/80">{t("metaYaflix.studio")}</label>
                <Input value={form.studio} onChange={(e) => setForm((p) => ({ ...p, studio: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/80">{t("metaYaflix.rating")}</label>
                <Input value={form.contentRating} onChange={(e) => setForm((p) => ({ ...p, contentRating: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/80">{t("metaYaflix.year")}</label>
                <Input value={form.year} onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/80">{t("metaYaflix.releaseDate")}</label>
              <Input value={form.originallyAvailableAt} onChange={(e) => setForm((p) => ({ ...p, originallyAvailableAt: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
            </div>

            {(metadata?.type === "season" || metadata?.type === "episode") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-white/80">
                    {metadata?.type === "episode" ? t("metaYaflix.episodeNumber") : t("metaYaflix.seasonNumber")}
                  </label>
                  <Input value={form.index} onChange={(e) => setForm((p) => ({ ...p, index: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
                </div>
                {metadata?.type === "episode" && (
                  <div className="space-y-2">
                    <label className="text-sm text-white/80">{t("metaYaflix.seasonNumber")}</label>
                    <Input value={form.parentIndex} onChange={(e) => setForm((p) => ({ ...p, parentIndex: e.target.value }))} className="bg-black/30 border-white/20 text-white" />
                  </div>
                )}
              </div>
            )}

            {saveError && <p className="text-sm text-red-400">{saveError}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => { setImageSaveError(null); setImageEditorOpen(true); }}>
                {t("metaYaflix.manageImages")}
              </Button>
              <Button type="button" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={onClose} disabled={saving}>
                {t("metaYaflix.cancel")}
              </Button>
              <Button type="submit" className="bg-plex hover:bg-plex/80 text-white" disabled={saving}>
                {saving ? t("metaYaflix.saving") : t("metaYaflix.saveChanges")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen && isImageEditorOpen} onOpenChange={(open) => { if (!open) setImageEditorOpen(false); }}>
        <DialogContent className="max-w-3xl bg-zinc-950 border-white/15 text-white">
          <DialogTitle>{t("metaYaflix.imageDialogTitle")}</DialogTitle>
          <DialogDescription className="text-white/70">
            Cambia poster, fondo y miniatura.
          </DialogDescription>
          <form className="space-y-4" onSubmit={handleSaveImages}>
            <div className="space-y-3 rounded-md border border-white/15 p-3 bg-black/20">
              <p className="text-sm font-medium text-white/90">{t("metaYaflix.imageUrls")}</p>
              <p className="text-xs text-white/60">Pega URLs públicas. Plex descargará y aplicará las imágenes.</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <label className="text-sm text-white/80">{t("metaYaflix.posterUrl")}</label>
                  <Input value={form.posterUrl} onChange={(e) => setForm((p) => ({ ...p, posterUrl: e.target.value }))} placeholder="https://..." className="bg-black/30 border-white/20 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">{t("metaYaflix.artUrl")}</label>
                  <Input value={form.artUrl} onChange={(e) => setForm((p) => ({ ...p, artUrl: e.target.value }))} placeholder="https://..." className="bg-black/30 border-white/20 text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-white/80">{t("metaYaflix.thumbUrl")}</label>
                  <Input value={form.thumbUrl} onChange={(e) => setForm((p) => ({ ...p, thumbUrl: e.target.value }))} placeholder="https://..." className="bg-black/30 border-white/20 text-white" />
                </div>
              </div>
              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-white/70 mb-2">{t("metaYaflix.autoSuggestions")}</p>
                {loadingImageSuggestions ? (
                  <p className="text-xs text-white/50">{t("metaYaflix.searchingImages")}</p>
                ) : (
                  <div className="space-y-3">
                    <SuggestionStrip title="Posters sugeridos" items={imageSuggestions.poster} onSelect={(v) => setForm((p) => ({ ...p, posterUrl: v }))} />
                    <SuggestionStrip title="Fondos sugeridos" items={imageSuggestions.art} onSelect={(v) => setForm((p) => ({ ...p, artUrl: v }))} />
                    <SuggestionStrip title="Miniaturas sugeridas" items={imageSuggestions.thumb} onSelect={(v) => setForm((p) => ({ ...p, thumbUrl: v }))} />
                  </div>
                )}
              </div>
            </div>

            {imageSaveError && <p className="text-sm text-red-400">{imageSaveError}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => setImageEditorOpen(false)} disabled={savingImages}>
                {t("metaYaflix.cancel")}
              </Button>
              <Button type="submit" className="bg-plex hover:bg-plex/80 text-white" disabled={savingImages}>
                {savingImages ? t("metaYaflix.saving") : t("metaYaflix.saveImages")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
