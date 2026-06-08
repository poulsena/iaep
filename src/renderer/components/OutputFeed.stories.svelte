<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import OutputFeed from "./OutputFeed.svelte";

  const { Story } = defineMeta({
    title: "Components/OutputFeed",
  });

  const sample = [
    {
      stageId: "diagnose",
      content:
        "Traced the null pointer to auth middleware line 42. Root cause: session token not validated before access.",
    },
    {
      stageId: "fix",
      content:
        "Applied guard clause. Added test case for unauthenticated session path.",
    },
    { stageId: "review", content: "LGTM. No regressions found." },
  ];
</script>

<Story name="Populated">
  <OutputFeed entries={sample} />
</Story>

<Story name="Empty">
  <OutputFeed entries={[]} />
</Story>
