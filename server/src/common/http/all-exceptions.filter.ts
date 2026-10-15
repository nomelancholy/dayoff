import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request } from 'express';

type DatabaseErrorLike = {
  code: string;
  message?: string;
  constraint?: string;
  table?: string;
};

/** Drizzle가 감싼 오류(cause)까지 따라가 Postgres 오류 코드를 찾습니다. */
function findDatabaseError(exception: unknown): DatabaseErrorLike | null {
  let current: unknown = exception;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current !== 'object') return null;
    const candidate = current as {
      code?: unknown;
      severity?: unknown;
      cause?: unknown;
    };
    // pg 서버 오류는 5자리 SQLSTATE와 severity를 함께 가집니다. (Node의 EPIPE 등과 구분)
    if (
      typeof candidate.code === 'string' &&
      /^[0-9A-Z]{5}$/.test(candidate.code) &&
      typeof candidate.severity === 'string'
    ) {
      return candidate as DatabaseErrorLike;
    }
    current = candidate.cause;
  }
  return null;
}

/**
 * 서비스에서 미리 걸러내지 못한 DB 제약 위반을 사용자가 이해할 수 있는 4xx로 바꿉니다.
 * 그 외 DB 오류는 기존처럼 500으로 처리합니다.
 */
function databaseErrorResponse(error: DatabaseErrorLike) {
  switch (error.code) {
    case '23505': // unique_violation
      return {
        statusCode: HttpStatus.CONFLICT,
        message: '이미 사용 중인 값이 있어 저장할 수 없습니다.',
      };
    case '23503': // foreign_key_violation
      return {
        statusCode: HttpStatus.CONFLICT,
        message:
          '다른 데이터에서 사용 중이거나 연결된 정보를 찾을 수 없어 처리할 수 없습니다.',
      };
    case '23502': // not_null_violation
    case '23514': // check_violation
    case '22P02': // invalid_text_representation (잘못된 uuid 등)
    case '22003': // numeric_value_out_of_range
    case '22001': // string_data_right_truncation
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: '입력값이 올바르지 않습니다.',
      };
    default:
      return null;
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.httpAdapterHost;
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const path = (request.originalUrl || request.url).split('?')[0];

    const databaseError =
      exception instanceof HttpException ? null : findDatabaseError(exception);
    const mapped = databaseError ? databaseErrorResponse(databaseError) : null;

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (mapped?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR);

    if (databaseError) {
      // 쿼리 파라미터에는 개인정보가 섞일 수 있어 원인 메시지와 제약 이름만 남깁니다.
      const detail = [
        databaseError.code,
        databaseError.constraint ?? databaseError.table,
        databaseError.message,
      ]
        .filter(Boolean)
        .join(' | ');
      const line = `${request.method} ${path} -> ${status}: DB ${detail}`;
      if (status >= 500) {
        this.logger.error(
          line,
          exception instanceof Error ? exception.stack : undefined,
        );
      } else {
        this.logger.warn(line);
      }
    } else if (status >= 500) {
      const message =
        exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `${request.method} ${path} -> ${status}: ${message}`,
        stack,
      );
    }

    const response =
      exception instanceof HttpException
        ? exception.getResponse()
        : (mapped ?? {
            statusCode: status,
            message: 'Internal server error',
          });
    const body =
      typeof response === 'string'
        ? { statusCode: status, message: response }
        : response;

    httpAdapter.reply(
      context.getResponse(),
      {
        ...body,
        timestamp: new Date().toISOString(),
        path,
      },
      status,
    );
  }
}
