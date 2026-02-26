"use client";

import { useSettings } from "@/components/settings-provider";

export default function Page() {
  const { t } = useSettings();
  return <p>{t("login.redirecting")}</p>;
}
