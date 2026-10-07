// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BootSplash } from './BootSplash';

describe('BootSplash', () => {
  it('로딩 상태를 알리고 마스코트와 도트를 보여준다', () => {
    const { container } = render(<BootSplash />);
    expect(screen.getByRole('status', { name: '불러오는 중' })).toBeTruthy();
    expect(container.querySelectorAll('.boot-dots span')).toHaveLength(3);
  });
});
