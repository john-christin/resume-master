import type { StyleConfig } from "../../types";
import { TooltipProvider } from "../ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CoverLetterTab } from "./CoverLetterTab";
import { EntriesTab, ListsTab, SectionsTab } from "./EntriesTabs";
import { HeaderFooterEditor, HeaderTab, HeadingsTab } from "./HeaderTabs";
import { DocumentTab, PageTab, TypographyTab } from "./PageTabs";
import { patcher } from "./patcher";

const TABS = [
  ["page", "Page"],
  ["typography", "Typography"],
  ["header", "Header"],
  ["headings", "Section Headings"],
  ["entries", "Entries"],
  ["lists", "Lists"],
  ["sections", "Sections"],
  ["header_footer", "Header & Footer"],
  ["cover_letter", "Cover Letter"],
  ["document", "Document"],
] as const;

export type EditorTab = (typeof TABS)[number][0];

export default function StyleEditor({
  config,
  onChange,
  onTabChange,
}: {
  config: StyleConfig;
  onChange: (c: StyleConfig) => void;
  onTabChange?: (tab: EditorTab) => void;
}) {
  const set = patcher(config, onChange);
  return (
    <TooltipProvider delayDuration={150}>
      <Tabs
        defaultValue="page"
        onValueChange={(v) => onTabChange?.(v as EditorTab)}
        className="space-y-3"
      >
        <TabsList className="h-auto flex-wrap justify-start gap-0.5">
          {TABS.map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="text-xs px-2.5">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="page">
          <PageTab value={config.page} onChange={(v) => set("page", v)} />
        </TabsContent>
        <TabsContent value="typography">
          <TypographyTab
            fonts={config.fonts}
            body={config.body}
            onFonts={(v) => set("fonts", v)}
            onBody={(v) => set("body", v)}
          />
        </TabsContent>
        <TabsContent value="header">
          <HeaderTab value={config.header} onChange={(v) => set("header", v)} />
        </TabsContent>
        <TabsContent value="headings">
          <HeadingsTab value={config.headings} onChange={(v) => set("headings", v)} />
        </TabsContent>
        <TabsContent value="entries">
          <EntriesTab value={config.entries} onChange={(v) => set("entries", v)} />
        </TabsContent>
        <TabsContent value="lists">
          <ListsTab
            value={config.entries.bullets}
            onChange={(v) => set("entries", { ...config.entries, bullets: v })}
          />
        </TabsContent>
        <TabsContent value="sections">
          <SectionsTab value={config.sections} onChange={(v) => set("sections", v)} />
        </TabsContent>
        <TabsContent value="header_footer">
          <HeaderFooterEditor value={config.header_footer} onChange={(v) => set("header_footer", v)} />
        </TabsContent>
        <TabsContent value="cover_letter">
          <CoverLetterTab value={config.cover_letter} onChange={(v) => set("cover_letter", v)} />
        </TabsContent>
        <TabsContent value="document">
          <DocumentTab value={config.properties} onChange={(v) => set("properties", v)} />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
