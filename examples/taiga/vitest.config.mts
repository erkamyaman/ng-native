import { ngNative } from '@ng-native/testing/vitest';
import { webCompat } from '@ng-native/web-compat/vitest';
import { defineConfig } from 'vitest/config';

const libraries = [
  '@angular/cdk',
  '@taiga-ui/core',
  '@taiga-ui/cdk',
  '@taiga-ui/kit',
  '@taiga-ui/styles',
  '@taiga-ui/event-plugins',
  '@taiga-ui/polymorpheus',
  '@taiga-ui/i18n',
  '@ng-web-apis/common',
  '@ng-web-apis/platform',
  '@ng-web-apis/mutation-observer',
  '@ng-web-apis/intersection-observer',
  '@ng-web-apis/resize-observer',
  '@ng-web-apis/screen-orientation',
  '@maskito/angular',
];

export default defineConfig({
  test: { maxWorkers: 1, testTimeout: 30_000 },
  plugins: [
    webCompat({ libraries }),
    ngNative({
      inline: [/@angular\/cdk/, /@taiga-ui\//, /@ng-web-apis\//, /@maskito\//],
    }),
  ],
});
