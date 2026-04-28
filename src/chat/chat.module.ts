import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ActiveUsersService } from './active-users.service';
import { ChatEventsService } from './chat-events.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule],
  providers: [ActiveUsersService, ChatEventsService, ChatGateway],
  exports: [ActiveUsersService, ChatEventsService],
})
export class ChatModule {}
