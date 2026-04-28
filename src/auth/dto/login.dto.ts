import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ali_123' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'username is required' })
  @Length(2, 24, {
    message: 'username must be between 2 and 24 characters',
  })
  @Matches(/^[A-Za-z0-9_]+$/, {
    message: 'username may contain only letters, numbers, and underscores',
  })
  username: string;
}
