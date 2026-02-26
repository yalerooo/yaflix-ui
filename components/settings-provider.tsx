import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { AppLanguage, translate } from "@/lib/i18n";

type TranslateParams = Record<string, string | number | undefined | null>;

const Context = createContext(
  {} as {
    updateDisableClearLogo: (value: boolean) => void;
    disableClearLogo: boolean;
    updateAccentColor: (color: string) => void;
    accentColor: string;
    language: AppLanguage;
    updateLanguage: (language: AppLanguage) => void;
    t: (key: string, params?: TranslateParams, fallback?: string) => string;
  },
);

const getStored = (key: string) =>
  typeof window !== "undefined" ? localStorage.getItem(key) : null;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [disableClearLogo, setDisableClearLogo] = useState(
    getStored("settings.disableClearLogo") === "true",
  );

  const [accentColor, setAccentColor] = useState(
    getStored("settings.accentColor") || "42 97% 46%",
  );

  const [language, setLanguage] = useState<AppLanguage>(() => {
    const stored = getStored("settings.language");
    if (stored === "es" || stored === "en") return stored;
    if (typeof navigator !== "undefined") {
      return navigator.language.toLowerCase().startsWith("es") ? "es" : "en";
    }
    return "en";
  });

  const updateDisableClearLogo = (value: boolean) => {
    setDisableClearLogo(value);
    localStorage.setItem("settings.disableClearLogo", value.toString());
  };

  const updateAccentColor = (color: string) => {
    setAccentColor(color);
    localStorage.setItem("settings.accentColor", color);
    document.documentElement.style.setProperty("--plex-accent", color);
  };

  const updateLanguage = (value: AppLanguage) => {
    setLanguage(value);
    localStorage.setItem("settings.language", value);
  };

  useEffect(() => {
    document.documentElement.style.setProperty("--plex-accent", accentColor);
  }, [accentColor]);

  const t = (key: string, params?: TranslateParams, fallback?: string) =>
    translate(language, key, params, fallback);

  return (
    <Context.Provider
      value={{
        updateDisableClearLogo,
        disableClearLogo,
        updateAccentColor,
        accentColor,
        language,
        updateLanguage,
        t,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useSettings() {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
