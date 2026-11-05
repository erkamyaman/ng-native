import { Component, signal } from '@angular/core';
import { Text } from '../../components/src/text.ts';
import { TextInput } from '../../components/src/text-input.ts';
import { View } from '../../components/src/view.ts';
import { ExpoGlass, ExpoGlassContainer } from '../../expo/src/glass.ts';

const template = `
  <view nativeID="view" [collapsable]="on()" />
  <text nativeID="text" [numberOfLines]="count()">Hello there</text>
  <text-input nativeID="input" [maxLength]="count()" />
  <expo-glass-container nativeID="container" [spacing]="count()">
    <expo-glass nativeID="glass" [isInteractive]="on()" />
  </expo-glass-container>
`;

/** Numeric and boolean inputs of components and expo views, bound to values to start with. */
@Component({
  selector: 'x-null-unsets-inputs',
  imports: [View, Text, TextInput, ExpoGlass, ExpoGlassContainer],
  template,
})
export class NullUnsetsInputs {
  readonly count = signal<number | null>(2);
  readonly on = signal<boolean | null>(false);
}

/** The same inputs bound to `null` from the first pass. */
@Component({
  selector: 'x-null-unsets-inputs-null',
  imports: [View, Text, TextInput, ExpoGlass, ExpoGlassContainer],
  template,
})
export class NullUnsetsInputsNull {
  readonly count = signal<number | null>(null);
  readonly on = signal<boolean | null>(null);
}
