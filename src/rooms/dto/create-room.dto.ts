import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: 'general' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'room name is required' })
  @Length(3, 32, {
    message: 'room name must be between 3 and 32 characters',
  })
  @Matches(/^[A-Za-z0-9-]+$/, {
    message: 'room name may contain only letters, numbers, and hyphens',
  })
  name: string;
}
