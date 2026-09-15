import { beforeEach, describe, expect, it, vi } from "vitest";
import { expandValueSet } from "./terminologyClient";

describe("terminology client", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns nested expansion codes exactly as supplied by the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          resourceType: "ValueSet",
          expansion: {
            contains: [
              {
                system: "https://example.test/CodeSystem/group",
                contains: [
                  {
                    system: "https://example.test/CodeSystem/source",
                    code: "server-code",
                    display: "  Server display  "
                  }
                ]
              }
            ]
          }
        })
      } as Response)
    );

    const result = await expandValueSet(
      "https://tx.example.test/fhir",
      "https://example.test/ValueSet/live",
      undefined,
      false
    );

    expect(result.codes).toEqual([
      {
        system: "https://example.test/CodeSystem/source",
        code: "server-code",
        display: "  Server display  "
      }
    ]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ValueSet/$expand?url="),
      expect.objectContaining({ headers: { Accept: "application/fhir+json" } })
    );
  });

  it("rejects an empty expansion instead of treating it as live terminology", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ resourceType: "ValueSet", expansion: {} })
      } as Response)
    );

    await expect(
      expandValueSet(
        "https://tx.example.test/fhir",
        "https://example.test/ValueSet/empty",
        undefined,
        false
      )
    ).rejects.toThrow("returned no codes");
  });
});
