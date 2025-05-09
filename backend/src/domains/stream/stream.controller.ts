import { Request, Response, NextFunction } from 'express';
import { streamService } from './stream.service';
import { CreateStreamInput, JoinStreamInput } from './stream.dto';
import { AuthenticatedUser } from '@/middleware/auth.middleware';
import { ParsedQs } from 'qs';

export const streamController = {
    async handleCreateStream(req: Request<{}, {}, CreateStreamInput>, res: Response, next: NextFunction) {
        try {
            const owner = req.user as AuthenticatedUser;
            if (!owner?.id) throw new Error("Authentication error");
            const ownerId = owner.id;
            const stream = await streamService.createStream(req.body, ownerId);
            res.status(201).json({ status: 'success', data: { stream } });
        } catch (error) {
            next(error);
        }
    },

    async handleJoinStream(req: Request<{}, {}, JoinStreamInput>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const stream = await streamService.joinStream(req.body, userId);
            res.status(200).json({ status: 'success', data: { stream } });
        } catch (error) {
            next(error);
        }
    },

    async handleGetMyStreams(req: Request<{}, {}, {}, { includeArchived?: string } & ParsedQs>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const includeArchived = req.query.includeArchived === 'true'; // Check query param
            const streams = await streamService.getMyStreams(user.id, includeArchived);
            res.status(200).json({ status: 'success', results: streams.length, data: { streams } });
        } catch (error) { next(error); }
    },

    async handleGetStreamDetails(req: Request<{ streamId: string }>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const userId = user.id;
            const streamId = req.params.streamId;
            const stream = await streamService.getStreamDetails(streamId, userId);
            res.status(200).json({ status: 'success', data: { stream } });
        } catch (error) {
            next(error);
        }
    },

    async handleLeaveStream(req: Request<{ streamId: string }>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const result = await streamService.leaveStream(req.params.streamId, user.id);
            res.status(200).json({ status: 'success', data: result });
        } catch (error) { next(error); }
    },

    async handleArchiveStream(req: Request<{ streamId: string }>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const stream = await streamService.archiveStream(req.params.streamId, user.id);
            res.status(200).json({ status: 'success', data: { stream } });
        } catch (error) { next(error); }
    },

    async handleUnarchiveStream(req: Request<{ streamId: string }>, res: Response, next: NextFunction) {
        try {
            const user = req.user as AuthenticatedUser;
            if (!user?.id) throw new Error("Authentication error");
            const stream = await streamService.unarchiveStream(req.params.streamId, user.id);
            res.status(200).json({ status: 'success', data: { stream } });
        } catch (error) { next(error); }
    },
};