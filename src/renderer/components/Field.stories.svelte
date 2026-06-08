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
