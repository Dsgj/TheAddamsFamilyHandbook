import ocr from '~/data/kit/ocr-text.json';
import type { OcrText } from '~/lib/model/types';

/** The kit's OCR text of every manual page, by document, page 1 at index 0. One of the three kit importers. */
export const OCR = ocr as OcrText;
