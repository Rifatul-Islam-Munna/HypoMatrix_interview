import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('login')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create user and return session token' })
  @ApiOkResponse({
    description: 'Login success',
    schema: {
      example: {
        success: true,
        data: {
          sessionToken: 'opaque-token',
          user: {
            id: 'usr_a1b2c3',
            username: 'ali_123',
            createdAt: '2024-03-01T10:00:00Z',
          },
        },
      },
    },
  })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.username);
  }
}
