import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, FACILITIES } from "../data/facilities";
import { createDemoDraft } from "../data/demo";
import { DEMO_PATIENTS } from "../data/patients";
import {
  createDraftRecord,
  incomingReferralsForAccount,
  notificationsForAccount,
  referralsForAccount,
  sentReferralsForAccount,
  updateDraftRecord
} from "./referralRecords";
import type { Notification } from "../types";

describe("contextual facility referral records", () => {
  beforeEach(() => localStorage.clear());

  it("creates and updates a draft owned by the initiating facility", () => {
    const draft = createDemoDraft(FACILITIES[0], FACILITIES[1], DEMO_PATIENTS[0]);
    const record = createDraftRecord(draft, DEMO_ACCOUNTS[0], FACILITIES[1].id);
    expect(record.status).toBe("draft");
    expect(record.referringOrganizationId).toBe("org-kalibo");
    expect(record.receivingOrganizationId).toBe("org-drstmh");
    const changed = { ...draft, referralNarrative: "Updated synthetic referral" };
    expect(
      updateDraftRecord(record, changed, FACILITIES[1].id).draft.referralNarrative
    ).toBe("Updated synthetic referral");
  });

  it("lets the same facility see sent and received referrals by direction", () => {
    const sent = createDraftRecord(
      createDemoDraft(FACILITIES[0], FACILITIES[1], DEMO_PATIENTS[0]),
      DEMO_ACCOUNTS[0],
      FACILITIES[1].id
    );
    const received = createDraftRecord(
      createDemoDraft(FACILITIES[1], FACILITIES[0], DEMO_PATIENTS[1]),
      DEMO_ACCOUNTS[1],
      FACILITIES[0].id
    );
    expect(referralsForAccount([sent, received], DEMO_ACCOUNTS[0])).toHaveLength(2);
    expect(sentReferralsForAccount([sent, received], DEMO_ACCOUNTS[0])).toEqual([sent]);
    expect(incomingReferralsForAccount([sent, received], DEMO_ACCOUNTS[0])).toEqual([received]);
    expect(referralsForAccount([sent, received], DEMO_ACCOUNTS[3])).toHaveLength(2);
  });

  it("supports South Cotabato as both an initiating and receiving facility", () => {
    const southAccount = DEMO_ACCOUNTS[2];
    const sent = createDraftRecord(
      createDemoDraft(FACILITIES[2], FACILITIES[0], DEMO_PATIENTS[2]),
      southAccount,
      FACILITIES[0].id
    );
    const received = createDraftRecord(
      createDemoDraft(FACILITIES[0], FACILITIES[2], DEMO_PATIENTS[0]),
      DEMO_ACCOUNTS[0],
      FACILITIES[2].id
    );
    expect(sentReferralsForAccount([sent, received], southAccount)).toEqual([sent]);
    expect(incomingReferralsForAccount([sent, received], southAccount)).toEqual([
      received
    ]);
  });

  it("scopes notifications to the target facility", () => {
    const notifications: Notification[] = [
      {
        id: "one",
        referralId: "r1",
        targetOrganizationId: "org-drstmh",
        title: "New referral",
        message: "Synthetic",
        read: false,
        createdAt: new Date().toISOString()
      },
      {
        id: "two",
        referralId: "r1",
        targetOrganizationId: "org-kalibo",
        title: "Accepted",
        message: "Synthetic",
        read: false,
        createdAt: new Date().toISOString()
      }
    ];
    expect(
      notificationsForAccount(notifications, DEMO_ACCOUNTS[1]).map(
        (item) => item.id
      )
    ).toEqual(["one"]);
    expect(notificationsForAccount(notifications, DEMO_ACCOUNTS[3])).toHaveLength(2);
  });
});
