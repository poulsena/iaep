import type { Decorator, Preview } from "@storybook/svelte-vite";
import "../src/renderer/app.css";

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "light";
  document.documentElement.setAttribute("data-theme", theme);
  return Story();
};

const preview: Preview = {
  globalTypes: {
    theme: {
      name: "Theme",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
  parameters: {
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: { test: "todo" },
  },
};

export default preview;
