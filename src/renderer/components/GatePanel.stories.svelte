<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import GatePanel from "./GatePanel.svelte";

  const { Story } = defineMeta({
    title: "Components/GatePanel",
  });
</script>

<Story name="Merge">
  <GatePanel visible type="merge" />
</Story>

<Story name="Approval">
  <GatePanel visible type="approval" />
</Story>
