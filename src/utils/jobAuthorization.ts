export async function authorizeJob(
  downloadOnly: boolean,
  uploadTypes: string[],
  apiKey: string,
  validateKey: (key: string) => Promise<boolean>,
) {
  if (downloadOnly || uploadTypes.every((type) => type === 'download')) {
    return { uploadTypes: ['download'], apiKey: '' };
  }

  if (!(await validateKey(apiKey))) return null;
  return { uploadTypes, apiKey };
}
