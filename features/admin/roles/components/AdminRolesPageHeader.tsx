import { hPage, muted } from "@/features/admin/adminUiTokens";
import { useI18n } from "@/contexts/LanguageContext";

export function AdminRolesPageHeader() {
  const { t } = useI18n();
  return (
    <header>
      <h1 className={hPage}>{t("admin.rolesPage.pageTitle")}</h1>
      <p className={`mt-1 max-w-2xl ${muted}`}>{t("admin.rolesPage.pageSubtitle")}</p>
    </header>
  );
}
