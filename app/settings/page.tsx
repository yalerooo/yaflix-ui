"use client";

import { APPBAR_HEIGHT } from "@/components/appbar";
import { useServer } from "@/components/server-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/components/settings-provider";
import { Button } from "@/components/ui/button";
import { GripVertical, ChevronUp, ChevronDown, RefreshCw } from "lucide-react";
import { useState } from "react";

const ACCENT_COLORS = [
  { name: "Plex Original", value: "42 97% 46%", color: "hsl(42, 97%, 46%)" },
  { name: "Rosa Pastel", value: "340 75% 85%", color: "hsl(340, 75%, 85%)" },
  { name: "Lavanda Pastel", value: "270 65% 85%", color: "hsl(270, 65%, 85%)" },
  { name: "Azul Pastel", value: "200 70% 80%", color: "hsl(200, 70%, 80%)" },
  { name: "Verde Menta", value: "150 60% 80%", color: "hsl(150, 60%, 80%)" },
  { name: "Amarillo Pastel", value: "50 70% 80%", color: "hsl(50, 70%, 80%)" },
  { name: "Coral Pastel", value: "10 75% 80%", color: "hsl(10, 75%, 80%)" },
  { name: "Melocotón Pastel", value: "20 80% 85%", color: "hsl(20, 80%, 85%)" },
  { name: "Celeste Pastel", value: "190 65% 80%", color: "hsl(190, 65%, 80%)" },
];

export default function Page() {
  const { libraries, disabledLibraries, toggleDisableLibrary, reorderLibraries, scanLibrary } = useServer();
  const { updateDisableClearLogo, disableClearLogo, updateAccentColor, accentColor } = useSettings();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [scanningLibraries, setScanningLibraries] = useState<Set<string>>(new Set());

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault();
    if (draggingIndex !== null && draggingIndex !== toIndex) {
      reorderLibraries(draggingIndex, toIndex);
    }
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      reorderLibraries(index, index - 1);
    }
  };

  const moveDown = (index: number) => {
    if (index < libraries.length - 1) {
      reorderLibraries(index, index + 1);
    }
  };

  const handleScanLibrary = async (libraryKey: string) => {
    setScanningLibraries(prev => new Set(prev).add(libraryKey));
    await scanLibrary(libraryKey);
    setTimeout(() => {
      setScanningLibraries(prev => {
        const next = new Set(prev);
        next.delete(libraryKey);
        return next;
      });
    }, 2000);
  };

  return (
    <div
      className={`w-full flex flex-col items-start justify-start p-4`}
      style={{ marginTop: APPBAR_HEIGHT }}
    >
      <h1 className="text-xl font-semibold tracking-wide leading-10">
        Settings
      </h1>
      <section className="py-2.5 space-y-4 w-full max-w-2xl">
        <h2 className="text-base font-semibold">Libraries</h2>
        {libraries.map((section, index) => (
          <div
            key={section.key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`glass rounded-xl p-3 transition-all duration-200 ${
              draggingIndex === index ? "opacity-50 scale-95" : "opacity-100"
            } hover:bg-white/10`}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              >
                <GripVertical className="w-5 h-5" />
              </button>
              
              <Label className="flex gap-2 items-center font-semibold flex-1 cursor-pointer">
                <Checkbox
                  checked={!disabledLibraries[section.title]}
                  onCheckedChange={() => toggleDisableLibrary(section.title)}
                />
                {section.title}
              </Label>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  className="h-8 w-8"
                >
                  <ChevronUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => moveDown(index)}
                  disabled={index === libraries.length - 1}
                  className="h-8 w-8"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleScanLibrary(section.key)}
                  disabled={scanningLibraries.has(section.key)}
                  className="h-8 w-8"
                  title="Scan library for new content"
                >
                  <RefreshCw className={`w-4 h-4 ${scanningLibraries.has(section.key) ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>
      <section className="py-2.5 space-y-4 w-full max-w-2xl">
        <h2 className="text-base font-semibold">Apariencia</h2>
        <div className="space-y-3">
          <Label className="text-sm font-medium">Color de acento</Label>
          <div className="grid grid-cols-3 gap-3">
            {ACCENT_COLORS.map((colorOption) => (
              <button
                key={colorOption.value}
                onClick={() => updateAccentColor(colorOption.value)}
                className={`glass rounded-xl p-3 transition-all duration-200 hover:scale-105 ${
                  accentColor === colorOption.value ? 'ring-2 ring-white/50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: colorOption.color }}
                  />
                  <span className="text-sm font-medium">{colorOption.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="py-2.5 space-y-4">
        <h2 className="text-base font-semibold">Misc</h2>
        <Label className="flex gap-2 items-center font-semibold">
          <Checkbox
            checked={disableClearLogo}
            onCheckedChange={(checked) => updateDisableClearLogo(!!checked)}
          />
          Disable clear logos
        </Label>
      </section>
    </div>
  );
}
