import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  args: {
    children: '버튼',
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Plain: Story = {};

export const Sticker: Story = {
  args: {
    variant: 'sticker',
  },
};

export const Disabled: Story = {
  args: {
    variant: 'sticker',
    disabled: true,
  },
};
