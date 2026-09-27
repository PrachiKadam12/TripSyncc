import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ALLOWED_EVENT_TYPES,
  DEFAULT_EVENT_CHANNELS,
  buildNotification,
  checkDocumentExpiries,
} from '../services/notificationService.js';
import * as notificationService from '../services/notificationService.js';
import * as offlineStorage from '../services/offlineStorage.js';

vi.mock('../services/offlineStorage.js', () => ({
  getOfflineNotifications: vi.fn(),
  saveOfflineNotification: vi.fn(),
  bulkPutOfflineNotifications: vi.fn(),
  markOfflineNotificationRead: vi.fn(),
  markAllOfflineNotificationsRead: vi.fn(),
}));

describe('Notification Service — Phase 2 Foundation', () => {
  it('exposes exactly the 4 approved event types', () => {
    expect(ALLOWED_EVENT_TYPES).toEqual([
      'group_invitation',
      'member_response',
      'passport_expiry',
      'insurance_expiry',
    ]);
    expect(ALLOWED_EVENT_TYPES.length).toBe(4);
  });

  it('enforces correct notification delivery channels for each event', () => {
    // 1. Group invitation: In-App: YES, SMS: Optional (false), WhatsApp: YES
    expect(DEFAULT_EVENT_CHANNELS.group_invitation).toEqual({
      in_app: true,
      sms: false,
      whatsapp: true,
    });

    // 2. Member response: In-App: YES, SMS: Optional (false), WhatsApp: YES
    expect(DEFAULT_EVENT_CHANNELS.member_response).toEqual({
      in_app: true,
      sms: false,
      whatsapp: true,
    });

    // 3. Passport expiry: In-App: YES, SMS: YES, WhatsApp: YES
    expect(DEFAULT_EVENT_CHANNELS.passport_expiry).toEqual({
      in_app: true,
      sms: true,
      whatsapp: true,
    });

    // 4. Insurance expiry: In-App: YES, SMS: YES, WhatsApp: YES
    expect(DEFAULT_EVENT_CHANNELS.insurance_expiry).toEqual({
      in_app: true,
      sms: true,
      whatsapp: true,
    });
  });

  it('rejects arbitrary event types outside the 4 approved events', () => {
    const invalidTypes = [
      'flight_disruption',
      'recovery_plan',
      'weather',
      'sos',
      'generic_alert',
      'random_event',
    ];

    for (const badType of invalidTypes) {
      expect(() => {
        buildNotification({
          user_id: 'usr-123',
          event_type: badType,
          title: 'Alert',
          message: 'Some alert message',
        });
      }).toThrow(/Disallowed event_type/);
    }
  });

  it('builds valid notification with default channel mapping and pending status', () => {
    const notif = buildNotification({
      user_id: 'usr-456',
      event_type: 'passport_expiry',
      title: 'Passport Expiration Notice',
      message: 'Your passport expires in 25 days.',
    });

    expect(notif.user_id).toBe('usr-456');
    expect(notif.event_type).toBe('passport_expiry');
    expect(notif.title).toBe('Passport Expiration Notice');
    expect(notif.read).toBe(false);
    expect(notif.sync_status).toBe('pending');
    expect(notif.channels).toEqual({
      in_app: true,
      sms: true,
      whatsapp: true,
    });
    expect(notif.id).toBeDefined();
    expect(notif.created_at).toBeDefined();
  });

  it('sanitizes potential sensitive document/card numbers from messages', () => {
    const notif = buildNotification({
      user_id: 'usr-789',
      event_type: 'insurance_expiry',
      title: 'Policy 987654321 renewal',
      message: 'Policy number 123456789012 is expiring.',
    });

    expect(notif.title).not.toContain('987654321');
    expect(notif.title).toContain('******');
    expect(notif.message).not.toContain('123456789012');
    expect(notif.message).toContain('******');
  });

  it('requires both title and message', () => {
    expect(() => {
      buildNotification({
        user_id: 'usr-1',
        event_type: 'group_invitation',
        title: '',
        message: 'Hello',
      });
    }).toThrow(/Notification requires both title and message/);

    expect(() => {
      buildNotification({
        user_id: 'usr-1',
        event_type: 'group_invitation',
        title: 'Title',
        message: '',
      });
    }).toThrow(/Notification requires both title and message/);
  });
});

describe('Expiry Notification Deduplication (Phase 3 Fix)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    
    // Mock local storage extras
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({
        passportExpiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // exactly 7 days
      })),
      setItem: vi.fn(),
    });
  });

  it('generates 7-day reminder correctly', async () => {
    vi.spyOn(offlineStorage, 'getOfflineNotifications').mockResolvedValue([]);
    const notifySpy = vi.spyOn(notificationService, 'notifyPassportExpiry').mockResolvedValue();

    await checkDocumentExpiries('usr-1');

    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
      reminderDays: 7
    }));
  });

  it('repeated check does not duplicate the same reminder', async () => {
    vi.spyOn(offlineStorage, 'getOfflineNotifications').mockResolvedValue([
      {
        event_type: 'passport_expiry',
        related_id: 'profile_passport',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { reminder_days: 7 }
      }
    ]);
    const notifySpy = vi.spyOn(notificationService, 'notifyPassportExpiry').mockResolvedValue();

    await checkDocumentExpiries('usr-1');

    // Should be skipped due to deduplication of the exact 7-day reminder
    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('different reminder points are NOT incorrectly suppressed (e.g. 3-day reminder is fired even if 7-day exists)', async () => {
    // Make the document expire in 3 days
    const expiryStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => JSON.stringify({ passportExpiryDate: expiryStr }))
    });

    // The 7-day reminder exists from a few days ago (e.g. created 4 days ago)
    vi.spyOn(offlineStorage, 'getOfflineNotifications').mockResolvedValue([
      {
        event_type: 'passport_expiry',
        related_id: 'profile_passport',
        expires_at: expiryStr,
        created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { reminder_days: 7 } // The old 7-day reminder
      }
    ]);
    const notifySpy = vi.spyOn(notificationService, 'notifyPassportExpiry').mockResolvedValue();

    await checkDocumentExpiries('usr-1');

    // Should fire the 3-day reminder because the existing one is 7-day
    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
      reminderDays: 3
    }));
  });
});
