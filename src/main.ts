import { ValidationError, ValidationPipe, HttpStatus } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiException } from './common/api-exception';
import { RedisIoAdapter } from './redis/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const redisIoAdapter = new RedisIoAdapter(app);

  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => buildValidationException(errors),
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Anonymous Chat API')
    .setDescription('NestJS real-time anonymous group chat API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

function buildValidationException(errors: ValidationError[]) {
  const first = errors[0];
  const message =
    first?.constraints && Object.values(first.constraints).length > 0
      ? Object.values(first.constraints)[0]
      : 'Validation error';

  if (first?.property === 'content') {
    if (message === 'Message content must not exceed 1000 characters') {
      return new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'MESSAGE_TOO_LONG',
        message,
      );
    }

    return new ApiException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'MESSAGE_EMPTY',
      'Message content must not be empty',
    );
  }

  return new ApiException(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', message);
}
