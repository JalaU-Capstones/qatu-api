import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  extractBoundary,
  multipartProductImageMiddleware,
  parseMultipartProductImage,
} from '../multipartProductImageMiddleware.js';

const BOUNDARY = 'TestBoundary123';

const buildPayload = ({
  field = 'image',
  filename = 'chair.webp',
  contentType = 'image/webp',
  body = 'IMAGE_DATA',
  includeHeaders = true,
  crlfBeforeDelimiter = true,
  crlfAfterDelimiter = true,
  closing = true,
} = {}) => {
  const headers = includeHeaders
    ? `Content-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
    : '';
  const suffix = crlfBeforeDelimiter ? '\r\n' : '';
  const prefix = crlfAfterDelimiter ? '\r\n' : '';
  return Buffer.from(
    `--${BOUNDARY}${prefix}${headers}${body}${suffix}--${BOUNDARY}${closing ? '--\r\n' : ''}`
  );
};

describe('multipartProductImageMiddleware', () => {
  describe('extractBoundary', () => {
    it('extracts unquoted and quoted boundaries case-insensitively', () => {
      expect(extractBoundary('multipart/form-data; boundary=---abc123')).toBe('---abc123');
      expect(extractBoundary('Multipart/Form-Data; BOUNDARY="quoted-boundary"')).toBe(
        'quoted-boundary'
      );
    });

    it('returns null for non-strings, other content types and missing boundaries', () => {
      expect(extractBoundary(undefined)).toBeNull();
      expect(extractBoundary(null)).toBeNull();
      expect(extractBoundary('application/json')).toBeNull();
      expect(extractBoundary('multipart/form-data')).toBeNull();
    });
  });

  describe('parseMultipartProductImage', () => {
    it('extracts image field metadata and binary buffer', () => {
      const parsed = parseMultipartProductImage(buildPayload(), BOUNDARY);

      expect(parsed).toEqual({
        fieldName: 'image',
        originalName: 'chair.webp',
        mimeType: 'image/webp',
        buffer: Buffer.from('IMAGE_DATA'),
        size: 10,
      });
    });

    it('lowercases the MIME type and tolerates a blank filename', () => {
      const parsed = parseMultipartProductImage(
        buildPayload({ filename: '', contentType: 'IMAGE/JPEG' }),
        BOUNDARY
      );

      expect(parsed.originalName).toBe('');
      expect(parsed.mimeType).toBe('image/jpeg');
    });

    it('returns null when there is no image part', () => {
      const parsed = parseMultipartProductImage(buildPayload({ field: 'other' }), BOUNDARY);

      expect(parsed).toBeNull();
    });

    it('returns null when headers are incomplete', () => {
      const parsed = parseMultipartProductImage(buildPayload({ includeHeaders: false }), BOUNDARY);

      expect(parsed).toBeNull();
    });

    it('returns null when a part has no next delimiter', () => {
      const payload = Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"\r\n\r\nIMAGE_DATA`
      );
      expect(parseMultipartProductImage(payload, BOUNDARY)).toBeNull();
    });

    it('returns null when the first delimiter is followed by the closing marker', () => {
      const payload = Buffer.from(`----${BOUNDARY}--\r\n`);
      expect(parseMultipartProductImage(payload, BOUNDARY)).toBeNull();
    });

    it('handles parts without CRLF around delimiters', () => {
      const parsed = parseMultipartProductImage(
        buildPayload({ crlfBeforeDelimiter: false, crlfAfterDelimiter: false }),
        BOUNDARY
      );

      expect(parsed.buffer.toString()).toBe('IMAGE_DATA');
    });

    it('returns null for a buffer without any delimiter', () => {
      expect(parseMultipartProductImage(Buffer.from('plain text'), BOUNDARY)).toBeNull();
    });

    it('skips parts without a name match before finding an image', () => {
      const payload = Buffer.from(
        `--${BOUNDARY}\r\nContent-Type: text/plain\r\n\r\nignored\r\n` +
          `--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"\r\n` +
          'Content-Type: image/png\r\n\r\nPNG\r\n' +
          `--${BOUNDARY}--\r\n`
      );

      expect(parseMultipartProductImage(payload, BOUNDARY)).toMatchObject({
        fieldName: 'image',
        mimeType: 'image/png',
      });
    });

    it('defaults the MIME type when the part has no Content-Type header', () => {
      const payload = Buffer.from(
        `--${BOUNDARY}\r\nContent-Disposition: form-data; name="image"\r\n\r\nPNG\r\n--${BOUNDARY}--\r\n`
      );

      expect(parseMultipartProductImage(payload, BOUNDARY)).toMatchObject({
        fieldName: 'image',
        mimeType: '',
        buffer: Buffer.from('PNG'),
      });
    });
  });

  describe('middleware', () => {
    const buildRequest = (contentType) => {
      const req = new EventEmitter();
      req.headers = contentType === undefined ? {} : { 'content-type': contentType };
      return req;
    };

    it('calls next immediately when req.file already exists', () => {
      const next = vi.fn();

      multipartProductImageMiddleware({ file: { buffer: Buffer.from('x') } }, {}, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('rejects a missing or non-multipart Content-Type with 400', () => {
      for (const contentType of [undefined, 'application/json']) {
        const next = vi.fn();
        multipartProductImageMiddleware(buildRequest(contentType), {}, next);
        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 })
        );
      }
    });

    it('populates req.file from a streamed multipart payload', () => {
      const req = buildRequest(`multipart/form-data; boundary=${BOUNDARY}`);
      const next = vi.fn();

      multipartProductImageMiddleware(req, {}, next);
      const payload = buildPayload();
      req.emit('data', payload.subarray(0, 20));
      req.emit('data', payload.subarray(20));
      req.emit('end');

      expect(next).toHaveBeenCalledWith();
      expect(req.file).toEqual({
        buffer: Buffer.from('IMAGE_DATA'),
        mimeType: 'image/webp',
        size: 10,
        originalName: 'chair.webp',
      });
    });

    it('accepts string chunks and rejects an image field with an empty body', () => {
      const req = buildRequest(`multipart/form-data; boundary=${BOUNDARY}`);
      const next = vi.fn();

      multipartProductImageMiddleware(req, {}, next);
      req.emit('data', buildPayload({ body: '' }).toString());
      req.emit('end');

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 })
      );
      expect(req.file).toBeUndefined();
    });

    it('rejects a missing image field with 400', () => {
      const req = buildRequest(`multipart/form-data; boundary=${BOUNDARY}`);
      const next = vi.fn();

      multipartProductImageMiddleware(req, {}, next);
      req.emit('data', buildPayload({ field: 'other' }));
      req.emit('end');

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
          message: 'image field is required',
        })
      );
    });

    it('stops reading and reports 422 when the stream exceeds 5 MB', () => {
      const req = buildRequest(`multipart/form-data; boundary=${BOUNDARY}`);
      const next = vi.fn();

      multipartProductImageMiddleware(req, {}, next);
      req.emit('data', Buffer.alloc(5 * 1024 * 1024 + 64 * 1024 + 1));
      req.emit('data', Buffer.from('ignored'));
      req.emit('error', new Error('ignored'));
      req.emit('end');

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'FILE_TOO_LARGE',
          statusCode: 422,
          message: 'The image exceeds the maximum size of 5 MB.',
        })
      );
    });

    it('forwards a stream error once and ignores subsequent events', () => {
      const req = buildRequest(`multipart/form-data; boundary=${BOUNDARY}`);
      const next = vi.fn();
      const error = new Error('stream failed');

      multipartProductImageMiddleware(req, {}, next);
      req.emit('error', error);
      req.emit('error', new Error('second'));
      req.emit('data', Buffer.from('ignored'));
      req.emit('end');

      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
