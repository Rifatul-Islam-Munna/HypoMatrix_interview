import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'hello everyone', maxLength: 1000 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Message content must not be empty' })
  @IsNotEmpty({ message: 'Message content must not be empty' })
  @MaxLength(1000, {
    message: 'Message content must not exceed 1000 characters',
  })
  content: string;
}
