export type ItemKind = 'stack' | 'equipment' | 'epic';

export interface ItemDefinition {
  class: string;
  name: string;
  category: string;
  kind: ItemKind;
}
