// tests/dietary.test.ts  
import { describe, it, expect } from 'vitest';
import { getCurrentMeal, MEAL_SCHEDULE, DIET_TYPES, FOOD_PREFS } from '@/lib/dietary/dietary-hooks';

describe('Dietary constants', () => {
  it('has 7 meal slots', () => {
    expect(MEAL_SCHEDULE).toHaveLength(7);
    expect(MEAL_SCHEDULE.map(m => m.key)).toEqual([
      'early_tea', 'breakfast', 'mid_morning', 'lunch', 'evening_tea', 'dinner', 'bedtime',
    ]);
  });

  it('has Indian food preferences including jain', () => {
    expect(FOOD_PREFS).toContain('jain');
    expect(FOOD_PREFS).toContain('veg');
    expect(FOOD_PREFS).toContain('nonveg');
  });

  it('includes Indian-specific diet types', () => {
    expect(DIET_TYPES).toContain('diabetic');
    expect(DIET_TYPES).toContain('renal');
    expect(DIET_TYPES).toContain('cardiac');
    expect(DIET_TYPES).toContain('tube_feed');
  });

  it('getCurrentMeal returns valid meal key', () => {
    const meal = getCurrentMeal();
    expect(MEAL_SCHEDULE.map(m => m.key)).toContain(meal);
  });
});
