import type { CoverLetterSettings } from "../../types";
import { Block, Field, Grid, HintText, NumberField, SelectField, SubHeading, SwitchField } from "./controls";
import { patcher } from "./patcher";
import { BorderSideEditor, ParagraphEditor, TextStyleEditor } from "./StyleBlocks";
import { HeaderFooterEditor, SeparatorField } from "./HeaderTabs";

export function CoverLetterTab({
  value,
  onChange,
}: {
  value: CoverLetterSettings;
  onChange: (v: CoverLetterSettings) => void;
}) {
  const set = patcher(value, onChange);
  const matches = value.letterhead === "match_resume";
  return (
    <div className="space-y-4">
      <Block title="Margins (inches)">
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
        </Grid>
      </Block>

      <SubHeading>Letterhead</SubHeading>
      <Block>
        <div className="max-w-xs">
          <Field label="Letterhead layout">
            <SelectField
              value={value.letterhead}
              onChange={(v) => set("letterhead", v)}
              options={[
                { label: "Left", value: "left" },
                { label: "Centered", value: "centered" },
                { label: "Right", value: "right" },
                { label: "Match resume header", value: "match_resume" },
              ]}
            />
          </Field>
        </div>
        {matches ? (
          <HintText>
            The letterhead reuses the resume header styling, so the name and contact settings below are not used. Alignment
            follows the letterhead layout; paragraph alignment is ignored.
          </HintText>
        ) : (
          <HintText>Alignment follows the letterhead layout; paragraph alignment is ignored.</HintText>
        )}
      </Block>
      <TextStyleEditor title="Name" value={value.name} onChange={(v) => set("name", v)} />
      <SwitchField label="Uppercase name" checked={value.name_uppercase} onChange={(v) => set("name_uppercase", v)} />
      <ParagraphEditor title="Name paragraph" hideAlign value={value.name_para} onChange={(v) => set("name_para", v)} />
      <TextStyleEditor title="Contact" value={value.contact} onChange={(v) => set("contact", v)} />
      <SeparatorField label="Contact separator" value={value.contact_separator} onChange={(v) => set("contact_separator", v)} />
      <ParagraphEditor title="Contact paragraph" hideAlign value={value.contact_para} onChange={(v) => set("contact_para", v)} />
      <Block title="Line under the letterhead">
        <BorderSideEditor value={value.letterhead_border} onChange={(v) => set("letterhead_border", v)} />
        <HintText>Style “None” disables the line. It replaces any borders on the last letterhead paragraph.</HintText>
      </Block>

      <SubHeading>Date &amp; recipient</SubHeading>
      <Block>
        <div className="flex flex-wrap items-end gap-5">
          <SwitchField label="Include date" checked={value.include_date} onChange={(v) => set("include_date", v)} />
          <div className="w-48">
            <Field label="Date format">
              <SelectField
                value={value.date_format}
                onChange={(v) => set("date_format", v)}
                options={[
                  { label: "Long (March 05, 2026)", value: "long" },
                  { label: "US (03/05/2026)", value: "us" },
                  { label: "ISO (2026-03-05)", value: "iso" },
                ]}
              />
            </Field>
          </div>
          <SwitchField label="Include recipient block" checked={value.include_recipient} onChange={(v) => set("include_recipient", v)} />
        </div>
        <HintText>The recipient block (“Hiring Manager” + company) is added under the date when a company is known.</HintText>
      </Block>
      <TextStyleEditor title="Date" value={value.date} onChange={(v) => set("date", v)} />
      <ParagraphEditor title="Date paragraph" value={value.date_para} onChange={(v) => set("date_para", v)} />

      <SubHeading>Body</SubHeading>
      <TextStyleEditor title="Body text (also used for the recipient)" value={value.body} onChange={(v) => set("body", v)} />
      <ParagraphEditor title="Body paragraph" defaultOpen value={value.body_para} onChange={(v) => set("body_para", v)} />

      <SubHeading>Header &amp; footer</SubHeading>
      <HeaderFooterEditor value={value.header_footer} onChange={(v) => set("header_footer", v)} />
    </div>
  );
}
