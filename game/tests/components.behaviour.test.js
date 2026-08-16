import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { attach, defineComponent } from '../src/ecs/components.js';

describe('component registry behaviour', () => {
  test('attaches a component by merging defaults with explicit overrides', () => {
    defineComponent('behaviour-merge', {
      defaults: { kind: 'drift', force: 26, speed: 165 }
    });

    const entity = { x: 0, y: 0 };
    const component = attach(entity, 'behaviour-merge', { force: 42 });

    assert.deepEqual(component, { kind: 'drift', force: 42, speed: 165 });
    assert.deepEqual(entity.comp['behaviour-merge'], component);
  });

  test('initializes the component bag for a fresh entity and runs apply hooks', () => {
    defineComponent('behaviour-apply', {
      defaults: { strength: 3 },
      apply(e, c) {
        e.power = c.strength * 2;
      }
    });

    const entity = {};
    attach(entity, 'behaviour-apply', { strength: 5 });

    assert.ok(entity.comp);
    assert.equal(entity.power, 10);
    assert.deepEqual(entity.comp['behaviour-apply'], { strength: 5 });
  });

  test('rejects unknown components instead of silently attaching empty data', () => {
    const entity = {};
    assert.throws(() => attach(entity, 'missing-observer'), /Unknown component: missing-observer/);
    assert.equal(entity.comp, undefined);
  });
});
