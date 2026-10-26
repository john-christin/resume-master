import type { BodySettings, DocProperties, FontSettings, PageSettings } from "../../types";
import { patcher } from "./patcher";
import { ATS_WARNING_TEXT, PDF_FONT_HINT } from "./constants";
import {
  Block,
  Field,
  FontSelect,
  Grid,
  HintText,
  NumberField,
  SelectField,
  SubHeading,
  SwitchField,
  TextField,
  WarnIcon,
} from "./controls";
import { BorderSideEditor, ParagraphEditor, TextStyleEditor } from "./StyleBlocks";

export function PageTab({ value, onChange }: { value: PageSettings; onChange: (v: PageSettings) => void }) {
  const set = patcher(value, onChange);
  return (
    <div className="space-y-4">
      <Block title="Paper">
        <Grid cols={2}>
          <Field label="Size">
            <SelectField
              value={value.size}
              onChange={(v) => set("size", v)}
              options={[
                { label: "Letter (8.5 × 11 in)", value: "letter" },
                { label: "A4 (210 × 297 mm)", value: "a4" },
                { label: "Legal (8.5 × 14 in)", value: "legal" },
              ]}
            />
          </Field>
          <Field label="Orientation">
            <SelectField
              value={value.orientation}
              onChange={(v) => set("orientation", v)}
              options={[
                { label: "Portrait", value: "portrait" },
                { label: "Landscape", value: "landscape" },
              ]}
            />
          </Field>
        </Grid>
      </Block>

      <Block title="Resume margins (inches)">
        <Grid cols={4}>
          <Field label="Top">
            <NumberField value={value.margin_top} min={0} max={4} step={0.05} onChange={(v) => set("margin_top", v)} />
          </Field>
          <Field label="Bottom">
            <NumberField value={value.margin_bottom} min={0} max={4} step={0.05} onChange={(v) => set("margin_bottom", v)} />
          </Field>
          <Field label="Left">
            <NumberField value={value.margin_left} min={0} max={4} step={0.05} onChange={(v) => set("margin_left", v)} />
          </Field>
          <Field label="Right">
            <NumberField value={value.margin_right} min={0} max={4} step={0.05} onChange={(v) => set("margin_right", v)} />
          </Field>
          <Field label="Gutter">
            <NumberField value={value.gutter} min={0} max={3} step={0.05} onChange={(v) => set("gutter", v)} />
          </Field>
          <Field label="Header distance">
            <NumberField value={value.header_distance} min={0} max={3} step={0.05} onChange={(v) => set("header_distance", v)} />
          </Field>
          <Field label="Footer distance">
            <NumberField value={value.footer_distance} min={0} max={3} step={0.05} onChange={(v) => set("footer_distance", v)} />
          </Field>
        </Grid>
        <SwitchField label="Mirror margins" checked={value.mirror_margins} onChange={(v) => set("mirror_margins", v)} />
        <HintText>The cover letter has its own margins (Cover Letter tab). Paper size and orientation apply to both.</HintText>
      </Block>

      <Block title="Page border">
        <BorderSideEditor
          value={value.page_border}
          onChange={(v) => set("page_border", v)}
          warn
        />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <WarnIcon text={ATS_WARNING_TEXT} /> Style “None” disables the border. Page borders may reduce ATS parse-ability.
        </p>
      </Block>
    </div>
  );
}

export function TypographyTab({
  fonts,
  body,
  onFonts,
  onBody,
}: {
  fonts: FontSettings;
  body: BodySettings;
  onFonts: (v: FontSettings) => void;
  onBody: (v: BodySettings) => void;
}) {
  const setF = patcher(fonts, onFonts);
  const setB = patcher(body, onBody);
  return (
    <div className="space-y-4">
      <Block title="Document font">
        <div className="max-w-xs">
          <FontSelect label="Font family" value={fonts.family} allowInherit={false} onChange={(v) => v && setF("family", v)} />
        </div>
        <div className="flex flex-wrap gap-5">
          <SwitchField label="Kerning" checked={fonts.kerning} onChange={(v) => setF("kerning", v)} />
          <SwitchField label="Auto hyphenation" checked={fonts.auto_hyphenation} onChange={(v) => setF("auto_hyphenation", v)} />
          <SwitchField label="Widow / orphan control" checked={fonts.widow_control} onChange={(v) => setF("widow_control", v)} />
        </div>
        <HintText>{PDF_FONT_HINT} Only ATS-friendly fonts are offered.</HintText>
      </Block>

      <SubHeading>Body text</SubHeading>
      <TextStyleEditor title="Body text (summary, bullets, skills)" value={body.text} onChange={(v) => setB("text", v)} />
      <ParagraphEditor title="Summary paragraph" value={body.summary_para} onChange={(v) => setB("summary_para", v)} />

      <SubHeading>Skills</SubHeading>
      <TextStyleEditor title="Skill category label" value={body.skills_category} onChange={(v) => setB("skills_category", v)} />
      <ParagraphEditor title="Skills paragraph" value={body.skills_para} onChange={(v) => setB("skills_para", v)} />
      <div className="max-w-xs">
        <TextField label="Skills separator" value={body.skills_separator} onChange={(v) => setB("skills_separator", v)} />
      </div>
    </div>
  );
}

export function DocumentTab({ value, onChange }: { value: DocProperties; onChange: (v: DocProperties) => void }) {
  const set = patcher(value, onChange);
  const str = (v: string) => (v === "" ? null : v);
  return (
    <Block title="Document properties">
      <Grid cols={2}>
        <TextField label="Title" value={value.title ?? ""} placeholder="e.g. {Name} - Resume (default)" onChange={(v) => set("title", str(v))} />
        <TextField label="Author" value={value.author ?? ""} placeholder="Candidate name (default)" onChange={(v) => set("author", str(v))} />
        <TextField label="Keywords" value={value.keywords ?? ""} onChange={(v) => set("keywords", str(v))} />
        <TextField label="Language (BCP-47)" value={value.language ?? ""} placeholder="en-US" onChange={(v) => set("language", str(v))} />
      </Grid>
      <HintText>Leave a field empty to use the default. Properties are written to the DOCX metadata.</HintText>
    </Block>
  );
}
