// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TextInput } from './TextInput';

afterEach(cleanup);

describe('TextInput', () => {
  it('컨셉 클래스를 달고 값·플레이스홀더·변경을 전달한다', () => {
    const onChange = vi.fn();
    render(<TextInput id="nick" value="햄" placeholder="2~12자" onChange={onChange} />);
    const input = screen.getByPlaceholderText('2~12자');
    expect(input.className).toContain('text-input');
    expect(input.getAttribute('value')).toBe('햄');
    fireEvent.change(input, { target: { value: '햄찌' } });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('disabled를 전달한다', () => {
    render(<TextInput id="nick" value="" onChange={() => {}} disabled />);
    expect(screen.getByRole('textbox').hasAttribute('disabled')).toBe(true);
  });
});
