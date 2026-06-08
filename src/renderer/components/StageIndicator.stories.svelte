<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import StageIndicator from "./StageIndicator.svelte";

  const { Story } = defineMeta({
    title: "Components/StageIndicator",
  });
</script>

<Story name="Idle">
  <StageIndicator stage="—" status="idle" />
</Story>

<Story name="Running">
  <StageIndicator stage="diagnose" status="running" />
</Story>

<Story name="Terminal">
  <StageIndicator stage="review" status="terminal" />
</Story>

<Story name="Blocked">
  <StageIndicator stage="review" status="blocked" />
</Story>
