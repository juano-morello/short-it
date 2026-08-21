import type { Meta, StoryObj } from "@storybook/react-vite";
import { MetricCard } from "../components/MetricCard.js";

const meta = {
  title: "Console/MetricCard",
  component: MetricCard,
  args: {
    label: "UNIQUE VISITORS / DAY",
    value: "1,280",
    detail: "Derived from daily privacy-preserving identifiers",
  },
} satisfies Meta<typeof MetricCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
