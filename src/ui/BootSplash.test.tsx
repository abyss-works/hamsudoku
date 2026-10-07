// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BootSplash } from './BootSplash';

describe('BootSplash', () => {
  it('로딩 상태를 알리고 홈 문구를 보여준다', () => {
    render(<BootSplash />);
    expect(screen.getByRole('status', { name: '불러오는 중' })).toBeTruthy();
    expect(screen.getByText('숨은 햄스터를 찾아라')).toBeTruthy();
  });
});
