<script module>
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import Form from "./Form.svelte";
  import Field from "./Field.svelte";
  import Button from "./Button.svelte";

  const { Story } = defineMeta({
    title: "Components/Form",
  });
</script>

<Story name="Idle">
  <Form status="idle" onsubmit={() => {}}>
    <Field
      label="Repository path"
      placeholder="/home/user/project"
      onpick={() => Promise.resolve("/home/user/my-project")}
    />
    <Field
      label="Lane"
      type="select"
      options={["quick-change", "full-feature"]}
      value="quick-change"
    />
    <Button variant="primary">Start run</Button>
  </Form>
</Story>

<Story name="Running">
  <Form status="running" onsubmit={() => {}}>
    <Field
      label="Repository path"
      value="/home/user/project"
      onpick={() => Promise.resolve("/home/user/my-project")}
    />
    <Field
      label="Lane"
      type="select"
      options={["quick-change", "full-feature"]}
      value="quick-change"
    />
    <Button variant="primary">Running…</Button>
  </Form>
</Story>
