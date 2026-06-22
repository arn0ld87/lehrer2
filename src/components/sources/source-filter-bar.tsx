import { FilterButton } from "../ui/shared";

/** Filterbar für das Quellenregister. Im UI-Schritt rein visuell. */
export function SourceFilterBar() {
  return (
    <div className="flex gap-2 flex-wrap mb-4">
      <FilterButton active>Alle Quellen</FilterButton>
      <FilterButton>Deutsch</FilterButton>
      <FilterButton>Religion</FilterButton>
      <FilterButton>OFFICIAL_BINDING</FilterButton>
      <FilterButton>Prüfung erforderlich</FilterButton>
      <FilterButton icon="filter">Weitere Filter</FilterButton>
    </div>
  );
}