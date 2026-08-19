import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof raw === "object" && raw && "message" in raw ? (raw as { message: unknown }).message : "Internal server error";
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(`${request.method} ${request.url}`, exception instanceof Error ? exception.stack : undefined);
    response.status(status).json({ statusCode: status, message, error: status === HttpStatus.INTERNAL_SERVER_ERROR ? "Internal Server Error" : undefined, path: request.url, timestamp: new Date().toISOString() });
  }
}
