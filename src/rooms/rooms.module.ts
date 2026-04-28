import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [ChatModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
