import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateRoomDto } from './dto/create-room.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RoomsService } from './rooms.service';

@ApiTags('rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'List all rooms' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          rooms: [
            {
              id: 'room_x9y8z7',
              name: 'general',
              createdBy: 'ali_123',
              activeUsers: 4,
              createdAt: '2024-03-01T10:00:00Z',
            },
          ],
        },
      },
    },
  })
  listRooms() {
    return this.rooms.listRooms();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new room' })
  @ApiCreatedResponse({
    schema: {
      example: {
        success: true,
        data: {
          id: 'room_x9y8z7',
          name: 'general',
          createdBy: 'ali_123',
          createdAt: '2024-03-01T10:00:00Z',
        },
      },
    },
  })
  createRoom(
    @Body() body: CreateRoomDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rooms.createRoom(body.name, user);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Paginated message history' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'before', required: false, example: 'msg_zz9900' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          messages: [
            {
              id: 'msg_ab12cd',
              roomId: 'room_x9y8z7',
              username: 'ali_123',
              content: 'hello everyone',
              createdAt: '2024-03-01T10:05:22Z',
            },
          ],
          hasMore: true,
          nextCursor: 'msg_zz9900',
        },
      },
    },
  })
  listMessages(
    @Param('id') roomId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.rooms.listMessages(roomId, limit, before);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Persist and broadcast a message' })
  @ApiCreatedResponse({
    schema: {
      example: {
        success: true,
        data: {
          id: 'msg_ab12cd',
          roomId: 'room_x9y8z7',
          username: 'ali_123',
          content: 'hello everyone',
          createdAt: '2024-03-01T10:05:22Z',
        },
      },
    },
  })
  sendMessage(
    @Param('id') roomId: string,
    @Body() body: SendMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rooms.sendMessage(roomId, body.content, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get room details' })
  @ApiOkResponse({
    schema: {
      example: {
        success: true,
        data: {
          id: 'room_x9y8z7',
          name: 'general',
          createdBy: 'ali_123',
          activeUsers: 4,
          createdAt: '2024-03-01T10:00:00Z',
        },
      },
    },
  })
  getRoom(@Param('id') roomId: string) {
    return this.rooms.getRoom(roomId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete room and messages' })
  @ApiOkResponse({
    schema: {
      example: { success: true, data: { deleted: true } },
    },
  })
  deleteRoom(
    @Param('id') roomId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rooms.deleteRoom(roomId, user);
  }
}
