import { describe, expect, it } from 'vitest';
import { sentryEnvironment } from './deployEnv';

describe('sentryEnvironment', () => {
  it('production과 staging은 그대로 반환한다', () => {
    expect(sentryEnvironment('production')).toBe('production');
    expect(sentryEnvironment('staging')).toBe('staging');
  });

  it('DEPLOY_ENV가 없으면 로컬 개발로 본다', () => {
    expect(sentryEnvironment(undefined)).toBe('development');
    expect(sentryEnvironment('')).toBe('development');
  });

  it('허용하지 않는 값이면 오류를 던진다', () => {
    expect(() => sentryEnvironment('preview')).toThrow('DEPLOY_ENV');
  });
});
