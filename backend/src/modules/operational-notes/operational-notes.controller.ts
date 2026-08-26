import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { OperationalNotesService, type NotesActor } from './operational-notes.service';
import { JwtAuthGuard } from '../../security/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../security/auth/permissions.guard';
import { CurrentUser, RequirePermissions } from '../../security/auth/decorators';
import type { AuthedRequest } from '../../security/auth/jwt-auth.guard';

/* ------------------------------------------------------------------ */
/*  DTOs                                                              */
/* ------------------------------------------------------------------ */

class CreateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;

  @IsOptional()
  @IsString()
  visibility?: string;
}

class UpdateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;
}

class ListNotesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  pageSize?: number;
}

/* ------------------------------------------------------------------ */
/*  Controller                                                        */
/* ------------------------------------------------------------------ */

/**
 * REST API: /operational-notes → Notes CRUD + RBAC (Phase 3 Step 3.5, Round 2B).
 *
 * Routes:
 *   GET    /operational-notes/:entityType/:entityId  — list notes
 *   POST   /operational-notes/:entityType/:entityId  — create note
 *   PATCH  /operational-notes/:noteId                — update note
 *   DELETE /operational-notes/:noteId                — soft-delete note
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('operational-notes')
export class OperationalNotesController {
  constructor(private readonly notesService: OperationalNotesService) {}

  /**
   * List notes for an entity with server-side pagination.
   * Permission: operational-notes.read
   */
  @Get(':entityType/:entityId')
  @RequirePermissions('operational-notes.read')
  listNotes(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() query: ListNotesQuery,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    const notesActor: NotesActor = {
      userId: actor.id,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      permissions: actor.permissions,
      partnerId: actor.partnerId,
      customerId: actor.customerId,
    };
    return this.notesService.listNotes(entityType, entityId, notesActor, {
      page: query.page,
      pageSize: query.pageSize,
    });
  }

  /**
   * Create a new operational note for an entity.
   * Permission: operational-notes.create
   */
  @Post(':entityType/:entityId')
  @RequirePermissions('operational-notes.create')
  createNote(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Body() dto: CreateNoteDto,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    const notesActor: NotesActor = {
      userId: actor.id,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      permissions: actor.permissions,
      partnerId: actor.partnerId,
      customerId: actor.customerId,
    };
    return this.notesService.createNote(
      {
        entityType,
        entityId,
        text: dto.text,
        visibility: dto.visibility,
      },
      notesActor,
    );
  }

  /**
   * Update an existing operational note.
   * Permission: operational-notes.update
   * Authorization: author or ADMIN
   */
  @Patch(':noteId')
  @RequirePermissions('operational-notes.update')
  updateNote(
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    const notesActor: NotesActor = {
      userId: actor.id,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      permissions: actor.permissions,
      partnerId: actor.partnerId,
      customerId: actor.customerId,
    };
    return this.notesService.updateNote(noteId, dto.text, notesActor);
  }

  /**
   * Soft-delete an operational note.
   * Permission: operational-notes.delete
   * Authorization: author or ADMIN
   */
  @Delete(':noteId')
  @RequirePermissions('operational-notes.delete')
  deleteNote(
    @Param('noteId') noteId: string,
    @CurrentUser() actor: AuthedRequest['user'],
  ) {
    const notesActor: NotesActor = {
      userId: actor.id,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      permissions: actor.permissions,
      partnerId: actor.partnerId,
      customerId: actor.customerId,
    };
    return this.notesService.deleteNote(noteId, notesActor);
  }
}
