import { describe, it, expect } from 'vitest';

describe('Appointment slot generation', () => {
  const generateSlots = (startHour: number, endHour: number, slotMinutes: number) => {
    const slots: string[] = [];
    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += slotMinutes) {
        if (h === endHour - 1 && m + slotMinutes > 60) break;
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
    return slots;
  };

  it('generates 15-minute slots for 9 AM to 1 PM', () => {
    const slots = generateSlots(9, 13, 15);
    expect(slots[0]).toBe('09:00');
    expect(slots[slots.length - 1]).toBe('12:45');
    expect(slots.length).toBe(16);
  });

  it('generates 30-minute slots', () => {
    const slots = generateSlots(10, 12, 30);
    expect(slots).toEqual(['10:00', '10:30', '11:00', '11:30']);
  });

  it('handles single hour window', () => {
    const slots = generateSlots(14, 15, 20);
    expect(slots.length).toBe(3); // 14:00, 14:20, 14:40
  });
});

describe('Waiting time calculation', () => {
  const calcWait = (checkedInAt: string, now: string) => {
    return Math.round((new Date(now).getTime() - new Date(checkedInAt).getTime()) / 60000);
  };

  it('returns minutes waiting', () => {
    expect(calcWait('2026-03-22T09:00:00', '2026-03-22T09:25:00')).toBe(25);
  });

  it('returns 0 for same time', () => {
    expect(calcWait('2026-03-22T10:00:00', '2026-03-22T10:00:00')).toBe(0);
  });
});
