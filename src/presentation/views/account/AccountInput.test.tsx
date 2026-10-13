// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountInput } from './AccountInput';

afterEach(cleanup);

describe('AccountInput', () => {
  it('label, aria-label, input 속성을 보존하고 변경 시 onChange를 호출한다', () => {
    const onChange = vi.fn();
    render(
      <AccountInput
        label="이메일"
        type="email"
        ariaLabel="이메일"
        value="user@example.com"
        onChange={onChange}
        autoComplete="email"
        disabled={false}
      />,
    );

    expect(screen.getByText('이메일')).toBeDefined();
    const input = screen.getByRole('textbox', { name: '이메일' }) as HTMLInputElement;
    expect(input.type).toBe('email');
    expect(input.value).toBe('user@example.com');
    expect(input.autocomplete).toBe('email');

    fireEvent.change(input, { target: { value: 'new@example.com' } });
    expect(onChange).toHaveBeenCalledWith('new@example.com');
  });
});
