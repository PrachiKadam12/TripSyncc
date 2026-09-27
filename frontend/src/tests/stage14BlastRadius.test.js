import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchBlastRadius,
  computeClientBlastRadius,
  normalizeBlastRadiusResponse,
} from '../services/blastRadiusService.js';
import { generateRecoveryPlans } from '../services/recoveryService.js';

describe('Stage 14 — Blast Radius Dependency Graph Engine', () => {
  const sampleItems = [
    {
      id: 'flight-1',
      itemType: 'flight',
      title: 'Flight AI-123',
      startDateTime: '2026-10-10T08:30:00Z',
      endDateTime: '2026-10-10T11:30:00Z',
      location: 'Delhi',
      chain_id: 'delhi-manali',
    },
    {
      id: 'transfer-1',
      itemType: 'transfer',
      title: 'Airport Transfer Cab',
      startDateTime: '2026-10-10T12:15:00Z',
      endDateTime: '2026-10-10T18:45:00Z',
      location: 'Manali Highway',
      chain_id: 'delhi-manali',
    },
    {
      id: 'hotel-1',
      itemType: 'hotel',
      title: 'Mountain View Residency',
      startDateTime: '2026-10-10T19:00:00Z',
      endDateTime: '2026-10-14T11:00:00Z',
      location: 'Manali',
      chain_id: 'delhi-manali',
    },
    {
      id: 'activity-1',
      itemType: 'activity',
      title: 'Solang Paragliding',
      startDateTime: '2026-10-11T10:00:00Z',
      endDateTime: '2026-10-11T13:00:00Z',
      location: 'Solang Valley',
      chain_id: 'delhi-manali',
    },
    {
      id: 'unrelated-activity',
      itemType: 'activity',
      title: 'Independent Day 5 Spa',
      startDateTime: '2026-10-14T14:00:00Z',
      location: 'Old Manali',
      chain_id: 'separate-chain',
    },
  ];

  const sampleDependencies = [
    { from: 'flight-1', to: 'transfer-1', minimum_buffer_minutes: 45 },
    { from: 'transfer-1', to: 'hotel-1', minimum_buffer_minutes: 30 },
    { from: 'hotel-1', to: 'activity-1', minimum_buffer_minutes: 60 },
  ];

  it('1. Computes normalized blast radius graph structure', async () => {
    const result = await fetchBlastRadius({
      items: sampleItems,
      dependencies: sampleDependencies,
      rootItemId: 'flight-1',
      delayMinutes: 240,
    });

    expect(result).toBeDefined();
    expect(result.root_item_id).toBe('flight-1');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(result.nodes.length).toBe(5);
    expect(result.edges.length).toBe(3);
    expect(result.summary).toBeDefined();
    expect(result.summary.total).toBe(5);
  });

  it('2. Marks root disruption item as DIRECTLY_AFFECTED with high severity', async () => {
    const result = await fetchBlastRadius({
      items: sampleItems,
      dependencies: sampleDependencies,
      rootItemId: 'flight-1',
      delayMinutes: 240,
    });

    const rootNode = result.nodes.find((n) => n.item_id === 'flight-1');
    expect(rootNode).toBeDefined();
    expect(rootNode.impact_type).toBe('direct');
    expect(rootNode.status).toBe('DIRECTLY_AFFECTED');
    expect(rootNode.severity).toBe('high');
    expect(result.summary.direct).toBe(1);
  });

  it('3. Propagates downstream disruption to connected dependent items', async () => {
    const result = await fetchBlastRadius({
      items: sampleItems,
      dependencies: sampleDependencies,
      rootItemId: 'flight-1',
      delayMinutes: 240,
    });

    const transferNode = result.nodes.find((n) => n.item_id === 'transfer-1');
    expect(transferNode).toBeDefined();
    expect(transferNode.impact_type).toBe('downstream');
    expect(transferNode.status).toBe('DOWNSTREAM_AFFECTED');
    expect(transferNode.severity).toBe('high');
    expect(transferNode.reason).toContain('Missed connection');
  });

  it('4. Keeps unrelated independent itinerary chain NOT_AFFECTED', async () => {
    const result = await fetchBlastRadius({
      items: sampleItems,
      dependencies: sampleDependencies,
      rootItemId: 'flight-1',
      delayMinutes: 240,
    });

    const unrelatedNode = result.nodes.find((n) => n.item_id === 'unrelated-activity');
    expect(unrelatedNode).toBeDefined();
    expect(unrelatedNode.impact_type).toBe('not_affected');
    expect(unrelatedNode.status).toBe('NOT_AFFECTED');
    expect(unrelatedNode.severity).toBe('none');
    expect(result.summary.not_affected).toBeGreaterThanOrEqual(1);
  });

  it('5. Integrates seamlessly with Stage 13 recovery engine (single source of truth)', async () => {
    const disruption = {
      id: 'disr-flight-test',
      title: 'Flight Cancellation: AI-123',
      metadata: {
        affected_item_id: 'flight-1',
        expected_delay_minutes: 240,
      },
    };

    const recoveryResult = await generateRecoveryPlans({
      disruption,
      allItems: sampleItems,
      dependencies: sampleDependencies,
    });

    expect(recoveryResult.plans).toBeDefined();
    expect(recoveryResult.plans.length).toBeGreaterThan(0);
    expect(recoveryResult.blastRadius).toBeDefined();
    expect(recoveryResult.blastRadius.root_item_id).toBe('flight-1');
    expect(recoveryResult.blastRadius.summary.direct).toBe(1);
    expect(recoveryResult.blastRadius.summary.not_affected).toBeGreaterThanOrEqual(1);
  });

  it('6. Handles empty itinerary safely without throwing', async () => {
    const result = computeClientBlastRadius({
      items: [],
      dependencies: [],
      rootItemId: 'non-existent',
    });

    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.summary.total).toBe(0);
  });
});
