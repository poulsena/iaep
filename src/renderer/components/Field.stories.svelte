<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Field from "./Field.svelte";

  const { Story } = defineMeta({
    title: "Components/Field",
  });
</script>

<Story name="Text">
  <Field label="Repository path" placeholder="/home/user/project" />
</Story>

<Story name="Select">
  <Field
    label="Lane"
    type="select"
    options={["quick-change", "full-feature"]}
    value="quick-change"
  />
</Story>

<Story name="Text with Picker">
  <Field
    label="Repository path"
    placeholder="/home/user/project"
    onpick={() => Promise.resolve("/home/user/my-project")}
  />
</Story>

<Story name="Textarea">
  <Field label="Brief" type="textarea" placeholder="Describe what you want done…" />
</Story>

<Story name="Textarea Filled">
  <Field
    label="Brief"
    type="textarea"
    value={"Fix the flaky login test.\n\nIt intermittently fails on CI when the\nauth token cache hasn't been cleared between runs."}
  />
</Story>

<Story name="Textarea Disabled">
  <Field
    label="Brief"
    type="textarea"
    value="Running — input locked for the duration of the run."
    disabled
  />
</Story>
