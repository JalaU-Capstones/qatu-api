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

  it('extracts quoted boundaries and tolerates a missing one', () => {
    expect(extractBoundary('multipart/form-data; boundary="quoted"')).toBe('quoted');
    expect(extractBoundary(undefined)).toBeNull();
    expect(extractBoundary('multipart/form-data')).toBeNull();
  });

  it('returns null when a part has no next delimiter or no headers', () => {
    expect(parseMultipartImage(Buffer.from('plain text'), 'B')).toBeNull();
    expect(
      parseMultipartImage(
        Buffer.from('--B\r\nContent-Disposition: form-data; name="image"\r\n\r\nDATA'),
        'B'
      )
    ).toBeNull();
    expect(parseMultipartImage(Buffer.from('--B--\r\n'), 'B')).toBeNull();
    expect(parseMultipartImage(Buffer.from('--B\r\nbody\r\n--B--\r\n'), 'B')).toBeNull();
  });

  it('skips parts without a name before finding the image', () => {
    const payload = Buffer.from(
      '--B\r\nContent-Type: text/plain\r\n\r\nignored\r\n' +
        '--B\r\nContent-Disposition: form-data; name="image"\r\n' +
        'Content-Type: IMAGE/PNG\r\n\r\nPNG\r\n--B--\r\n'
    );

    expect(parseMultipartImage(payload, 'B')).toMatchObject({
      fieldName: 'image',
      mimeType: 'image/png',
      originalName: '',
    });
  });

  it('populates req.file from a streamed payload including string chunks', () => {
    const boundary = 'TestBoundary123';
    const req = new EventEmitter();
    req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
    const next = vi.fn();
    const payload = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\n` +
        'Content-Type: image/png\r\n\r\nPNG_DATA\r\n' +
        `--${boundary}--\r\n`
    );

    multipartAvatarMiddleware(req, {}, next);
    req.emit('data', payload.subarray(0, 30).toString());
    req.emit('data', payload.subarray(30));
    req.emit('end');

    expect(next).toHaveBeenCalledWith();
    expect(req.file).toMatchObject({
      fieldName: 'image',
      originalName: 'a.png',
      mimeType: 'image/png',
      size: 8,
    });
  });

  it('rejects an empty image field', () => {
    const boundary = 'BoundaryEmpty';
    const req = new EventEmitter();
    req.headers = { 'content-type': `multipart/form-data; boundary=${boundary}` };
    const next = vi.fn();

    multipartAvatarMiddleware(req, {}, next);
    req.emit(
      'data',
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="image"\r\n\r\n\r\n--${boundary}--\r\n`
      )
    );
    req.emit('end');

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 })
    );
  });

  it('rejects oversized streams and ignores subsequent events', () => {
    const req = new EventEmitter();
    req.headers = { 'content-type': 'multipart/form-data; boundary=B' };
    const next = vi.fn();

    multipartAvatarMiddleware(req, {}, next);
    req.emit('data', Buffer.alloc(2 * 1024 * 1024 + 64 * 1024 + 1));
    req.emit('data', Buffer.from('ignored'));
    req.emit('error', new Error('ignored'));
    req.emit('end');

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'FILE_TOO_LARGE',
        statusCode: 422,
        message: 'The image exceeds the maximum size of 2 MB.',
      })
    );
  });

  it('forwards a stream error once and ignores subsequent events', () => {
    const req = new EventEmitter();
    req.headers = { 'content-type': 'multipart/form-data; boundary=B' };
    const next = vi.fn();
    const error = new Error('stream failed');

    multipartAvatarMiddleware(req, {}, next);
    req.emit('error', error);
    req.emit('error', new Error('second'));
    req.emit('data', Buffer.from('ignored'));
    req.emit('end');

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  it('parses parts without CRLF padding around delimiters', () => {
    expect(
      parseMultipartImage(
        Buffer.from('--BContent-Disposition: form-data; name="image"\r\n\r\nDATA--B--\r\n'),
        'B'
      )
    ).toMatchObject({ fieldName: 'image', buffer: Buffer.from('DATA') });
  });

  it('rejects requests without a content-type header', () => {
    const req = new EventEmitter();
    req.headers = {};
    const next = vi.fn();

    multipartAvatarMiddleware(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR', statusCode: 400 })
    );
  });
});
