import type {
  PdfComponent,
  PdfDocument,
  PdfPage,
} from "./types";

export type PdfValidationWarning = {
  pageId: string;
  componentId: string;
  message: string;
};

export type PdfValidationResult = {
  valid: boolean;
  warnings: PdfValidationWarning[];
};

function validateComponent(
  page: PdfPage,
  component: PdfComponent,
): PdfValidationWarning[] {
  const warnings: PdfValidationWarning[] = [];

  const right =
    component.frame.x + component.frame.width;

  const bottom =
    component.frame.y + component.frame.height;

  if (component.frame.x < page.paddingMm) {
    warnings.push({
      pageId: page.id,
      componentId: component.id,
      message: "Component exceeds left safe zone",
    });
  }

  if (component.frame.y < page.paddingMm) {
    warnings.push({
      pageId: page.id,
      componentId: component.id,
      message: "Component exceeds top safe zone",
    });
  }

  if (right > page.widthMm - page.paddingMm) {
    warnings.push({
      pageId: page.id,
      componentId: component.id,
      message: "Component exceeds right safe zone",
    });
  }

  if (bottom > page.heightMm - page.paddingMm) {
    warnings.push({
      pageId: page.id,
      componentId: component.id,
      message: "Component exceeds bottom safe zone",
    });
  }

  return warnings;
}

export function validateDocument(
  document: PdfDocument,
): PdfValidationResult {
  const warnings: PdfValidationWarning[] = [];

  for (const page of document.pages) {
    for (const component of page.components) {
      warnings.push(
        ...validateComponent(page, component),
      );
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}
