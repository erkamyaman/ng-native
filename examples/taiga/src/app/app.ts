import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiButton, TuiDataList, TuiDropdown, TuiInput, TuiRoot } from '@taiga-ui/core';
import { TuiSwitch } from '@taiga-ui/kit/components/switch';
import { TuiTabs } from '@taiga-ui/kit/components/tabs';

/** Spike: a handful of Taiga pieces on one screen, to bundle with Metro. */
@Component({
  selector: 'app-root',
  imports: [TuiRoot, TuiButton, TuiInput, TuiDropdown, TuiDataList, TuiSwitch, TuiTabs, FormsModule],
  template: `
    <tui-root>
      <tui-tabs [(activeItemIndex)]="tab">
        <button tuiTab>First</button>
        <button tuiTab>Second</button>
      </tui-tabs>
      <tui-textfield>
        <label tuiLabel>Name</label>
        <input tuiInput [(ngModel)]="name" />
      </tui-textfield>
      <input type="checkbox" tuiSwitch [(ngModel)]="on" />
      <button tuiButton [tuiDropdown]="menu" [(tuiDropdownOpen)]="open">Menu</button>
      <ng-template #menu>
        <tui-data-list>
          <button tuiOption (click)="open = false">One</button>
        </tui-data-list>
      </ng-template>
      <button tuiButton appearance="secondary" (click)="count.set(count() + 1)">
        Pressed {{ count() }}
      </button>
    </tui-root>
  `,
})
export class App {
  protected tab = 0;
  protected name = '';
  protected on = false;
  protected open = false;
  protected readonly count = signal(0);
}
