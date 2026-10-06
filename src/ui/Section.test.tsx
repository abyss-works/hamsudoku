// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Section } from './Section';

afterEach(cleanup);

describe('Section', () => {
  it('제목과 자식을 섹션 컨테이너에 렌더한다', () => {
    render(
      <Section title="닉네임">
        <span>내용</span>
      </Section>,
    );
    expect(screen.getByRole('heading', { name: '닉네임' }).tagName).toBe('H4');
    expect(screen.getByText('내용').parentElement?.className).toContain('panel-section');
  });
});
