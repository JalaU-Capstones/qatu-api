import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import {
  extractBoundary,
  multipartAvatarMiddleware,
  parseMultipartImage,
} from '../multipartAvatarMiddleware.js';

describe('multipartAvatarMiddleware', () => {
  it('extractBoundary extracts quoted and unquoted boundaries', () => {
    expect(extractBoundary('multipart/form-data; boundary=---abc123')).toBe('---abc123');
    expect(extractBoundary('multipart/form-data; boundary="quoted-boundary"')).toBe(
      'quoted-boundary'
    );
    expect(extractBoundary('application/json')).toBeNull();
  });

  it('parseMultipartImage extracts image part metadata and binary buffer', () => {
    const boundary = 'TestBoundary123';
    const payload = Buffer.from(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="image"; filename="avatar.png"\r\n' +
        'Content-Type: image/png\r\n\r\n' +
        'PNG_DATA\r\n' +
        `--${boundary}--\r\n`
    );

    const parsed = parseMultipartImage(payload, boundary);
    expect(parsed).toEqual({
      fieldName: 'image',
      originalName: 'avatar.png',
      mimeType: 'image/png',
      buffer: Buffer.from('PNG_DATA'),
      size: 8,
    });
  });

  it('calls next immediately if req.file is already populated', () => {
    const req = { file: { buffer: Buffer.from('x') } };
    const next = vi.fn();
    multipartAvatarMiddleware(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next with 400 VALIDATION_ERROR when Content-Type is not multipart/form-data', () => {
    const req = new EventEmitter();
    req.headers = { 'content-type': 'application/json' };
    const next = vi.fn();

    multipartAvatarMiddleware(req, {}, next);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });

  it('calls next with 400 VALIDATION_ERROR when no image field is present', () => {
    const boundary = 'BoundaryNoImage';
    const req = new EventEmitter();
    req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
    const next = vi.fn();

    multipartAvatarMiddleware(req, {}, next);
    req.emit(
      'data',
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="other"\r\n\r\nval\r\n--${boundary}--\r\n`
      )
    );
    req.emit('end');

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      })
    );
  });
});
