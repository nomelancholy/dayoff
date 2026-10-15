import { ArgumentsHost, ConflictException, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const reply = jest.fn();
  const filter = new AllExceptionsFilter({
    httpAdapter: { reply },
  } as unknown as HttpAdapterHost);
  const host = {
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'DELETE',
        originalUrl: '/coupons/1?token=secret',
      }),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;

  /** Drizzle이 pg 오류를 감싸서 던지는 형태 */
  const queryError = (code: string, constraint?: string) =>
    Object.assign(
      new Error('Failed query: delete from "coupons"\nparams: a@b.com'),
      {
        cause: Object.assign(new Error('violates constraint'), {
          code,
          severity: 'ERROR',
          constraint,
        }),
      },
    );

  const lastReply = () => reply.mock.calls.at(-1) as [unknown, any, number];

  beforeEach(() => {
    reply.mockClear();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['23503', 409],
    ['23505', 409],
    ['22P02', 400],
    ['23502', 400],
  ])('DB 제약 위반 %s 는 %i 로 안내한다', (code, status) => {
    filter.catch(queryError(code, 'orders_coupon_id_coupons_id_fk'), host);

    const [, body, replyStatus] = lastReply();
    expect(replyStatus).toBe(status);
    expect(body.statusCode).toBe(status);
    expect(body.path).toBe('/coupons/1');
    // 쿼리·파라미터는 응답에 싣지 않는다.
    expect(JSON.stringify(body)).not.toContain('Failed query');
    expect(JSON.stringify(body)).not.toContain('a@b.com');
  });

  it('DB 오류 로그에는 쿼리 파라미터를 남기지 않는다', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn');

    filter.catch(queryError('23503', 'orders_coupon_id_coupons_id_fk'), host);

    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).toContain('orders_coupon_id_coupons_id_fk');
    expect(logged).not.toContain('a@b.com');
  });

  it('알 수 없는 DB 오류와 일반 오류는 500으로 처리한다', () => {
    filter.catch(queryError('40P01'), host);
    expect(lastReply()[2]).toBe(500);
    expect(lastReply()[1].message).toBe('Internal server error');

    // Node 시스템 오류 코드(EPIPE 등)는 DB 오류로 취급하지 않는다.
    filter.catch(
      Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }),
      host,
    );
    expect(lastReply()[2]).toBe(500);
  });

  it('HttpException은 그대로 전달한다', () => {
    filter.catch(new ConflictException('이미 존재하는 쿠폰 코드입니다.'), host);

    const [, body, status] = lastReply();
    expect(status).toBe(409);
    expect(body.message).toBe('이미 존재하는 쿠폰 코드입니다.');
  });
});
