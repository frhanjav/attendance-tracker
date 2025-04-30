import { Request, Response, NextFunction } from 'express';
import { streamService } from './stream.service';
import { CreateStreamInput, JoinStreamInput } from './stream.dto';

export const streamController = {
    async handleCreateStream(req: Request<{}, {}, CreateStreamInput>, res: Response, next: NextFunction) {
        try {
            const ownerId = req.user!.id; // User ID from auth middleware
            const stream = await streamService.createStream(req.body, ownerId);
            res.status(201).json({ status: 'success', data: { stream } });
        } catch (error) {
            next(error);
        }
    },

    async handleJoinStream(req: Request<{}, {}, JoinStreamInput>, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const stream = await streamService.joinStream(req.body, userId);
            res.status(200).json({ status: 'success', data: { stream } });
        } catch (error) {
            next(error);
        }
    },

    async handleGetMyStreams(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const streams = await streamService.getMyStreams(userId);
            res.status(200).json({ status: 'success', results: streams.length, data: { streams } });
        } catch (error) {
            next(error);
        }
    },

    async handleGetStreamDetails(req: Request<{ streamId: string }>, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.id;
            const streamId = req.params.streamId;
            const stream = await streamService.getStreamDetails(streamId, userId);
            res.status(200).json({ status: 'success', data: { stream } });
        } catch (error) {
            next(error);
        }
    },
};