// tests/physio.test.ts
import { describe, it, expect } from 'vitest';
import { SPORTS, COMP_LEVELS, RTS_PHASES, BODY_REGIONS, MODALITIES } from '@/lib/physiotherapy/physio-hooks';

describe('Physiotherapy constants', () => {
  it('includes Indian sports', () => {
    expect(SPORTS).toContain('cricket');
    expect(SPORTS).toContain('kabaddi');
    expect(SPORTS).toContain('badminton');
    expect(SPORTS).toContain('hockey');
  });

  it('has 5 competition levels', () => {
    expect(COMP_LEVELS).toHaveLength(5);
    expect(COMP_LEVELS).toContain('elite');
    expect(COMP_LEVELS).toContain('recreational');
  });

  it('has complete RTS phases', () => {
    expect(RTS_PHASES).toContain('phase_1_protection');
    expect(RTS_PHASES).toContain('phase_5_return_to_play');
    expect(RTS_PHASES).toContain('cleared');
  });

  it('has 18 modalities including modern ones', () => {
    expect(MODALITIES).toContain('dry_needling');
    expect(MODALITIES).toContain('shockwave_eswt');
    expect(MODALITIES).toContain('kinesio_tape');
    expect(MODALITIES).toContain('cupping');
    expect(MODALITIES.length).toBeGreaterThanOrEqual(18);
  });

  it('has TMJ in body regions', () => {
    expect(BODY_REGIONS).toContain('jaw_tmj');
    expect(BODY_REGIONS).toContain('pelvis');
  });
});
