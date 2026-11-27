import { describe, expect, mock, test } from 'bun:test';

import { authorizeJob } from '../src/utils/jobAuthorization';

describe('job authorization', () => {
  test('downloads need no upload key and never forward a saved key', async () => {
    const validate = mock(async () => false);
    for (const key of ['', 'saved-key']) {
      for (const [mode, types] of [
        [true, ['animation']],
        [false, ['download']],
        [false, []],
      ] as const) {
        expect(await authorizeJob(mode, [...types], key, validate)).toEqual({
          uploadTypes: ['download'],
          apiKey: '',
        });
      }
    }
    expect(validate).not.toHaveBeenCalled();
  });

  test('upload jobs submit only after successful key validation', async () => {
    const validate = mock(async (key: string) => key === 'valid');
    expect(await authorizeJob(false, ['animation'], '', validate)).toBeNull();
    expect(await authorizeJob(false, ['animation'], 'valid', validate)).toEqual({
      uploadTypes: ['animation'],
      apiKey: 'valid',
    });
    expect(validate.mock.calls).toEqual([[''], ['valid']]);
  });
});
