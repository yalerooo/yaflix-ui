import { createContext, ReactNode, useContext, useState, useEffect } from "react";

const Context = createContext(
  {} as {
    updateDisableClearLogo: (value: boolean) => void;
    disableClearLogo: boolean;
    updateAccentColor: (color: string) => void;
    accentColor: string;
  },
);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [disableClearLogo, setDisableClearLogo] = useState(
    localStorage.getItem("settings.disableClearLogo") === "true",
  );
  
  const [accentColor, setAccentColor] = useState(
    localStorage.getItem("settings.accentColor") || "42 97% 46%",
  );

  const updateDisableClearLogo = (value: boolean) => {
    setDisableClearLogo(value);
    localStorage.setItem("settings.disableClearLogo", value.toString());
  };
  
  const updateAccentColor = (color: string) => {
    setAccentColor(color);
    localStorage.setItem("settings.accentColor", color);
    document.documentElement.style.setProperty('--plex-accent', color);
  };
  
  useEffect(() => {
    document.documentElement.style.setProperty('--plex-accent', accentColor);
  }, [accentColor]);

  return (
    <Context.Provider value={{ updateDisableClearLogo, disableClearLogo, updateAccentColor, accentColor }}>
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
