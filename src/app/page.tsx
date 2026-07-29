import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-3xl font-semibold text-primary">{t("title")}</h1>
      <p className="text-text-muted">{t("subtitle")}</p>
    </main>
  );
}
