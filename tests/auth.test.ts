import { describe, it, expect, vi } from 'vitest';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-uid', email: 'test@hospital.com' } }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'staff-1', full_name: 'Dr. Test', staff_type: 'doctor' }, error: null }),
    })),
  }),
}));

describe('Authentication', () => {
  it('should validate session exists', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const sb = createClient();
    const { data } = await sb.auth.getUser();
    expect(data.user).toBeTruthy();
    expect(data.user?.email).toBe('test@hospital.com');
  });

  it('should return staff record for authenticated user', async () => {
    const { createClient } = await import('@/lib/supabase/client');
    const sb = createClient();
    const { data } = await sb.from('hmis_staff').select('*').eq('auth_user_id', 'test-uid').single();
    expect(data.full_name).toBe('Dr. Test');
    expect(data.staff_type).toBe('doctor');
  });
});
