<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Button from "./Button.svelte";

  const { Story } = defineMeta({
    title: "Components/Button",
  });
</script>

<Story name="Primary">
  <Button variant="primary">Start run</Button>
</Story>

<Story name="Destructive">
  <Button variant="destructive">Deny</Button>
</Story>

<Story name="Disabled">
  <Button variant="primary" disabled>Start run</Button>
</Story>
