// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('라벨과 입력을 묶어 렌더한다', () => {
    render(
      <Field label="닉네임" htmlFor="nick">
        <input id="nick" />
      </Field>,
    );
    expect(screen.getByLabelText('닉네임').getAttribute('id')).toBe('nick');
    expect(screen.getByLabelText('닉네임').parentElement?.className).toContain('field');
  });
});
