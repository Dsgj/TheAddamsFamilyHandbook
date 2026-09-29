import { describe, expect, it } from 'vitest';
import { precacheKeys } from '~/lib/precache';

const entry = (url: string) => ({ url, revision: 'r', size: 1 });
const keys = (scope: string, urls: string[]) =>
  precacheKeys(scope)(urls.map(entry)).manifest.map((e) => e.url);

describe('precache keys', () => {
  it('keys the home as the scope, with the trailing slash the links use', () => {
    expect(keys('/valvet/', ['index.html'])).toEqual(['/valvet/']);
    expect(keys('/', ['index.html'])).toEqual(['/']);
  });

  it('keys every other page by its extensionless path', () => {
    expect(
      keys('/valvet/', ['map.html', 'handbook/quick.html', 'switch/32.html', '404.html']),
    ).toEqual(['map', 'handbook/quick', 'switch/32', '404']);
  });

  it('leaves assets alone and keeps the revision', () => {
    expect(keys('/valvet/', ['_astro/app.js', 'data/parts.json', 'assets/figures/a.jpg'])).toEqual([
      '_astro/app.js',
      'data/parts.json',
      'assets/figures/a.jpg',
    ]);
    expect(precacheKeys('/')([entry('index.html')]).manifest[0]).toEqual({
      url: '/',
      revision: 'r',
      size: 1,
    });
  });
});
