const { getDefaultConfig } = require('expo/metro-config');
const { withAngularNative } = require('@ng-native/metro/config.cjs');
const { withWebCompat } = require('@ng-native/web-compat/metro');
const path = require('node:path');

const config = withAngularNative(getDefaultConfig(__dirname), {
  workspaceRoot: path.resolve(__dirname, '../..'),
});

module.exports = withWebCompat(config, {
  libraries: [
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
  ],
});
