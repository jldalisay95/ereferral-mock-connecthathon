import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, FACILITIES } from "../data/facilities";
import { createDemoDraft } from "../data/demo";
import {
  createDraftRecord,
  notificationsForAccount,
  referralsForAccount,
  updateDraftRecord
} from "./referralRecords";
import type { Notification } from "../types";

describe("facility-scoped referral records", () => {
  beforeEach(() => localStorage.clear());

  it("creates and updates a draft owned by the referring facility", () => {
    const draft = createDemoDraft(FACILITIES[0], FACILITIES[1]);
    const record = createDraftRecord(draft, DEMO_ACCOUNTS[0], FACILITIES[1].id);
    expect(record.status).toBe("draft");
    expect(record.referringOrganizationId).toBe("org-kalibo");
    expect(record.receivingOrganizationId).toBe("org-drstmh");
    const changed = { ...draft, referralNarrative: "Updated synthetic referral" };
    expect(updateDraftRecord(record, changed, FACILITIES[1].id).draft.referralNarrative)
      .toBe("Updated synthetic referral");
  });

  it("scopes sent, received, and admin tracker views", () => {
    const record = createDraftRecord(
      createDemoDraft(FACILITIES[0], FACILITIES[1]),
      DEMO_ACCOUNTS[0],
      FACILITIES[1].id
    );
    const unrelated = {
      ...record,
      id: crypto.randomUUID(),
      referringOrganizationId: "other",
      receivingOrganizationId: "other"
    };
    expect(referralsForAccount([record, unrelated], DEMO_ACCOUNTS[0])).toEqual([record]);
    expect(referralsForAccount([record, unrelated], DEMO_ACCOUNTS[1])).toEqual([record]);
    expect(referralsForAccount([record, unrelated], DEMO_ACCOUNTS[2])).toHaveLength(2);
  });

  it("scopes notifications to the target facility", () => {
    const notifications: Notification[] = [
      {
        id: "one",
        referralId: "r1",
        receivingOrganizationId: "org-drstmh",
        title: "New referral",
        message: "Synthetic",
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "two",
        referralId: "r1",
        receivingOrganizationId: "org-kalibo",
        title: "Accepted",
        message: "Synthetic",
        read: false,
        createdAt: new Date().toISOString()
      }
    ];
    expect(notificationsForAccount(notifications, DEMO_ACCOUNTS[1]).map((item) => item.id))
      .toEqual(["one"]);
    expect(notificationsForAccount(notifications, DEMO_ACCOUNTS[2])).toHaveLength(2);
  });
});
