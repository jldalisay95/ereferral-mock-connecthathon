import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeFirstReadableAttachment,
  decodeFhirAttachment,
  extensionForMimeType,
  filenameForAttachment,
  inferMimeTypeFromFilename,
  openDecodedAttachment,
  resolveFhirAttachmentUrl
} from "./attachments";

describe("attachment decoding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("decodes data URI attachments", () => {
    const decoded = decodeFhirAttachment({
      url: "data:application/pdf;base64,QUJD",
      title: "result.pdf"
    });

    expect(decoded).toMatchObject({
      data: "QUJD",
      contentType: "application/pdf",
      title: "result.pdf",
      isExternalUrl: false
    });
  });

  it("decodes raw Attachment.data values", () => {
    const decoded = decodeFhirAttachment({
      data: "QUJD",
      contentType: "image/png",
      title: "scan.png"
    });

    expect(decoded.data).toBe("QUJD");
    expect(decoded.contentType).toBe("image/png");
    expect(decoded.isExternalUrl).toBe(false);
  });

  it("keeps external URL attachments readable as links", () => {
    const decoded = decodeFhirAttachment({
      url: "https://example.test/reports/scan.jpg",
      title: "scan.jpg"
    });

    expect(decoded.data).toBe("");
    expect(decoded.url).toBe("https://example.test/reports/scan.jpg");
    expect(decoded.contentType).toBe("image/jpeg");
    expect(decoded.isExternalUrl).toBe(true);
  });

  it("infers MIME type and filename extensions", () => {
    expect(inferMimeTypeFromFilename("note.txt")).toBe("text/plain");
    expect(extensionForMimeType("application/pdf")).toBe("pdf");
    expect(filenameForAttachment("diagnostic-report", "image/png")).toBe(
      "diagnostic-report.png"
    );
  });

  it("selects the first readable attachment instead of title-only metadata", () => {
    const decoded = decodeFirstReadableAttachment(
      [
        { title: "metadata only" },
        { url: "Binary/123", title: "xray.png" }
      ],
      "https://server.test/fhir"
    );

    expect(decoded.url).toBe("https://server.test/fhir/Binary/123");
    expect(decoded.contentType).toBe("image/png");
    expect(decoded.isExternalUrl).toBe(true);
  });

  it("resolves relative FHIR attachment links against the configured server", () => {
    expect(resolveFhirAttachmentUrl("https://server.test/fhir", "Binary/123")).toBe(
      "https://server.test/fhir/Binary/123"
    );
    expect(
      resolveFhirAttachmentUrl(
        "https://server.test/fhir",
        "https://files.test/report.pdf"
      )
    ).toBe("https://files.test/report.pdf");
  });

  it("opens FHIR Binary attachment links as decoded file blobs", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        resourceType: "Binary",
        contentType: "application/pdf",
        data: "QUJD"
      })
    } as Response);
    URL.createObjectURL = vi.fn();
    URL.revokeObjectURL = vi.fn();
    const createObjectUrlMock = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:attachment");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const openMock = vi.spyOn(window, "open").mockReturnValue(null);

    await openDecodedAttachment({
      data: "",
      contentType: "application/pdf",
      title: "result.pdf",
      url: "https://server.test/fhir/Binary/123",
      isExternalUrl: true
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://server.test/fhir/Binary/123",
      { headers: { Accept: "application/fhir+json, application/json" } }
    );
    expect(createObjectUrlMock).toHaveBeenCalledWith(expect.any(Blob));
    expect(openMock).toHaveBeenCalledWith(
      "blob:attachment",
      "_blank",
      "noopener,noreferrer"
    );
  });
});
