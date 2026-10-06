// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Panel } from './Panel';

describe('Panel', () => {
  it('제목과 자식을 카드 컨테이너에 렌더한다', () => {
    render(
      <Panel title="닉네임">
        <span>내용</span>
      </Panel>,
    );
    expect(screen.getByText('닉네임').tagName).toBe('H3');
    expect(screen.getByText('내용').parentElement?.className).toContain('panel');
  });
});
