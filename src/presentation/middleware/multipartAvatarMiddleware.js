import { MAX_AVATAR_SIZE_BYTES } from '../../application/use-cases/UploadAvatarUseCase.js';

const MAX_MULTIPART_STREAM_BYTES = MAX_AVATAR_SIZE_BYTES + 64 * 1024;

/**
 * Extracts boundary parameter from a multipart/form-data Content-Type header.
 *
 * @param {string} contentType
 * @returns {string|null}
 */
export function extractBoundary(contentType) {
  if (
    typeof contentType !== 'string' ||
    !contentType.toLowerCase().includes('multipart/form-data')
  ) {
    return null;
  }
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  return match ? match[1] || match[2] : null;
}

/**
 * Parses a multipart/form-data Buffer and extracts the `image` file part.
 *
 * @param {Buffer} rawBuffer
 * @param {string} boundary
 * @returns {{ fieldName: string, originalName: string, mimeType: string, buffer: Buffer, size: number } | null}
 */
export function parseMultipartImage(rawBuffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const closingMarker = Buffer.from('--');
  const crlfMarker = Buffer.from('\r\n');
  const headerEndMarker = Buffer.from('\r\n\r\n');

  let searchStart = 0;
  while (searchStart < rawBuffer.length) {
    const partStart = rawBuffer.indexOf(delimiter, searchStart);
    if (partStart === -1) break;

    const afterDelimiter = partStart + delimiter.length;
    if (rawBuffer.subarray(afterDelimiter, afterDelimiter + 2).equals(closingMarker)) {
      // Closing boundary `--boundary--`
      break;
    }

    const nextDelimiter = rawBuffer.indexOf(delimiter, afterDelimiter);
    if (nextDelimiter === -1) break;

    // Skip leading CRLF after boundary
    let contentStart = afterDelimiter;
    if (rawBuffer.subarray(contentStart, contentStart + 2).equals(crlfMarker)) {
      contentStart += 2;
    }

    // Trim trailing CRLF before next boundary
    let partEnd = nextDelimiter;
    if (partEnd >= 2 && rawBuffer.subarray(partEnd - 2, partEnd).equals(crlfMarker)) {
      partEnd -= 2;
    }

    const partBuffer = rawBuffer.subarray(contentStart, partEnd);
    const headerEnd = partBuffer.indexOf(headerEndMarker);

    if (headerEnd !== -1) {
      const rawHeaders = partBuffer.subarray(0, headerEnd).toString('utf8');
      const bodyBuffer = partBuffer.subarray(headerEnd + headerEndMarker.length);

      const nameMatch = rawHeaders.match(/name="([^"]+)"/i);
      const filenameMatch = rawHeaders.match(/filename="([^"]*)"/i);
      const contentTypeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n;]+)/i);

      const fieldName = nameMatch ? nameMatch[1] : '';
      if (fieldName === 'image') {
        return {
          fieldName,
          originalName: filenameMatch ? filenameMatch[1] : '',
          mimeType: contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : '',
          buffer: Buffer.from(bodyBuffer),
          size: bodyBuffer.length,
        };
      }
    }

    searchStart = nextDelimiter;
  }

  return null;
}

/**
 * Express middleware that parses a multipart/form-data request for `POST /v1/profiles/me/avatar`
 * and attaches `req.file`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function multipartAvatarMiddleware(req, res, next) {
  if (req.file) {
    return next();
  }

  const contentType = req.headers?.['content-type'] || '';
  const boundary = extractBoundary(contentType);

  if (!boundary) {
    const err = new Error('Content-Type must be multipart/form-data');
    err.code = 'VALIDATION_ERROR';
    err.statusCode = 400;
    return next(err);
  }

  const chunks = [];
  let totalBytes = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    if (aborted) return;
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;

    if (totalBytes > MAX_MULTIPART_STREAM_BYTES) {
      aborted = true;
      const err = new Error('The image exceeds the maximum size of 2 MB.');
      err.code = 'FILE_TOO_LARGE';
      err.statusCode = 422;
      return next(err);
    }

    chunks.push(buf);
  });

  req.on('error', (err) => {
    if (aborted) return;
    aborted = true;
    return next(err);
  });

  req.on('end', () => {
    if (aborted) return;

    const rawBuffer = Buffer.concat(chunks);
    const parsedFile = parseMultipartImage(rawBuffer, boundary);

    if (!parsedFile || parsedFile.size === 0) {
      const err = new Error('Avatar image file is required');
      err.code = 'VALIDATION_ERROR';
      err.statusCode = 400;
      return next(err);
    }

    req.file = parsedFile;
    return next();
  });
}
