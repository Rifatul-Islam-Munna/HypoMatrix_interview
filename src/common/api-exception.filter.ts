import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorPayload } from './api-exception';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      success: false,
      error: this.toErrorPayload(exception, status),
    });
  }

  private toErrorPayload(
    exception: unknown,
    status: HttpStatus,
  ): ApiErrorPayload {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null) {
        const payload = body as Partial<ApiErrorPayload> & {
          message?: string | string[];
        };

        if (payload.code && payload.message) {
          return {
            code: payload.code,
            message: Array.isArray(payload.message)
              ? payload.message.join('; ')
              : payload.message,
          };
        }

        if (payload.message) {
          return {
            code: this.defaultCode(status),
            message: Array.isArray(payload.message)
              ? payload.message.join('; ')
              : payload.message,
          };
        }
      }

      if (typeof body === 'string') {
        return { code: this.defaultCode(status), message: body };
      }
    }

    return {
      code: this.defaultCode(status),
      message:
        status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : 'Request failed',
    };
  }

  private defaultCode(status: HttpStatus): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
    };

    return codes[status] ?? 'REQUEST_FAILED';
  }
}
