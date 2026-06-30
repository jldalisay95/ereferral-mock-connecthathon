export interface DecodedAttachment {
  data: string;
  contentType: string;
  title?: string;
  url?: string;
  isExternalUrl: boolean;
}

interface FhirAttachmentLike {
  data?: string;
  contentType?: string;
  title?: string;
  url?: string;
}

const DATA_URL_PATTERN = /^data:([^;,]+)?(;[^,]*)?;base64,(.+)$/i;

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value) || value.startsWith("data:");
}

function isFhirBinaryUrl(value: string | undefined) {
  return Boolean(value?.match(/(?:^|\/)Binary\/[^/?#]+(?:$|[?#])/));
}

export function resolveFhirAttachmentUrl(
  baseUrl: string,
  url: string | undefined
) {
  if (!url || isAbsoluteUrl(url)) return url;
  return `${baseUrl.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

export function extensionForMimeType(contentType: string) {
  const normalized = contentType.toLowerCase();
  if (normalized === "application/pdf") return "pdf";
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/png") return "png";
  if (normalized === "image/gif") return "gif";
  if (normalized === "image/tiff") return "tiff";
  if (normalized === "image/bmp") return "bmp";
  if (normalized === "text/plain") return "txt";
  if (normalized === "application/rtf") return "rtf";
  if (normalized === "application/msword") return "doc";
  if (
    normalized ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "bin";
}

export function inferMimeTypeFromFilename(filename: string | undefined) {
  const extension = filename?.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "tif" || extension === "tiff") return "image/tiff";
  if (extension === "bmp") return "image/bmp";
  if (extension === "txt") return "text/plain";
  if (extension === "rtf") return "application/rtf";
  if (extension === "doc") return "application/msword";
  if (extension === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "";
}

export function decodeFhirAttachment(
  attachment: FhirAttachmentLike | undefined
): DecodedAttachment {
  if (!attachment) {
    return { data: "", contentType: "", isExternalUrl: false };
  }
  if (attachment.data) {
    const contentType =
      attachment.contentType ||
      inferMimeTypeFromFilename(attachment.title) ||
      "application/octet-stream";
    return {
      data: attachment.data,
      contentType,
      title: attachment.title,
      isExternalUrl: false
    };
  }
  const match = attachment.url?.match(DATA_URL_PATTERN);
  if (match) {
    const contentType =
      match[1] ||
      attachment.contentType ||
      inferMimeTypeFromFilename(attachment.title) ||
      "application/octet-stream";
    return {
      data: match[3] ?? "",
      contentType,
      title: attachment.title,
      isExternalUrl: false
    };
  }
  return {
    data: "",
    contentType:
      attachment.contentType || inferMimeTypeFromFilename(attachment.title),
    title: attachment.title,
    url: attachment.url,
    isExternalUrl: Boolean(attachment.url)
  };
}

export function decodeFirstReadableAttachment(
  attachments: FhirAttachmentLike[] | undefined,
  baseUrl = ""
): DecodedAttachment {
  const decoded = (attachments ?? []).map((attachment) =>
    decodeFhirAttachment({
      ...attachment,
      url: resolveFhirAttachmentUrl(baseUrl, attachment.url)
    })
  );
  return (
    decoded.find((attachment) => attachment.data || attachment.url) ??
    decoded[0] ?? { data: "", contentType: "", isExternalUrl: false }
  );
}

export function filenameForAttachment(
  title: string | undefined,
  contentType: string | undefined
) {
  if (title?.includes(".")) return title;
  const extension = extensionForMimeType(contentType || "application/octet-stream");
  return `${title || "diagnostic-report-attachment"}.${extension}`;
}

export function base64ToBlob(base64: string, contentType: string) {
  const byteCharacters = window.atob(base64);
  const byteNumbers = Array.from(byteCharacters, (character) =>
    character.charCodeAt(0)
  );
  return new Blob([new Uint8Array(byteNumbers)], { type: contentType });
}

async function blobFromExternalAttachment(attachment: DecodedAttachment) {
  if (!attachment.url) return undefined;
  if (!isFhirBinaryUrl(attachment.url)) return undefined;
  const response = await fetch(attachment.url, {
    headers: { Accept: "application/fhir+json, application/json" }
  });
  if (!response.ok) {
    throw new Error(`Attachment fetch failed (${response.status}).`);
  }
  const resource = (await response.json()) as {
    resourceType?: string;
    contentType?: string;
    data?: string;
  };
  if (resource.resourceType !== "Binary" || !resource.data) {
    throw new Error("FHIR Binary attachment did not include readable data.");
  }
  return base64ToBlob(
    resource.data,
    resource.contentType ||
      attachment.contentType ||
      "application/octet-stream"
  );
}

function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadBlob(blob: Blob, attachment: DecodedAttachment) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameForAttachment(
    attachment.title,
    blob.type || attachment.contentType
  );
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadDecodedAttachment(attachment: DecodedAttachment) {
  if (attachment.isExternalUrl && attachment.url) {
    const blob = await blobFromExternalAttachment(attachment);
    if (blob) {
      downloadBlob(blob, attachment);
      return;
    }
    window.open(attachment.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!attachment.data) return;
  const blob = base64ToBlob(
    attachment.data,
    attachment.contentType || "application/octet-stream"
  );
  downloadBlob(blob, attachment);
}

export async function openDecodedAttachment(attachment: DecodedAttachment) {
  if (attachment.isExternalUrl && attachment.url) {
    const blob = await blobFromExternalAttachment(attachment);
    if (blob) {
      openBlob(blob);
      return;
    }
    window.open(attachment.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!attachment.data) return;
  const blob = base64ToBlob(
    attachment.data,
    attachment.contentType || "application/octet-stream"
  );
  openBlob(blob);
}
