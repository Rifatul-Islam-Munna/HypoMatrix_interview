import { HttpException, HttpStatus } from '@nestjs/common';

export type ApiErrorPayload = {
  code: string;
  message: string;
};

export class ApiException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super({ code, message }, status);
  }
}
