import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, ArchiveRestore, BarChart3, Clock, Loader2, LogOut, Users } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useAuth } from '../hooks/useAuth';
import { StreamDetailed, streamService } from '../services/stream.service';

const StreamPage: React.FC = () => {
    const { streamId } = useParams<{ streamId: string }>();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    const [isLeaveConfirmOpen, setIsLeaveConfirmOpen] = useState(false);
    const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);

    const { data: stream, isLoading, error, refetch: refetchStreamDetails } = useQuery<StreamDetailed, Error>({
        queryKey: ['stream', streamId],
        queryFn: () => streamService.getStreamDetails(streamId!),
        enabled: !!streamId && !!user,
    });

    const isOwner = user && stream && stream.ownerId === user.id;

    const leaveMutation = useMutation({
        mutationFn: () => streamService.leaveStream(streamId!),
        onSuccess: (data) => {
            toast.success(data.message);
            queryClient.invalidateQueries({ queryKey: ['myStreams'] });
            navigate('/dashboard');
        },
        onError: (err: Error) => toast.error(`Leave failed: ${err.message}`),
        onSettled: () => setIsLeaveConfirmOpen(false),
    });

    const archiveMutation = useMutation({
        mutationFn: () => streamService.archiveStream(streamId!),
        onSuccess: (updatedStreamData) => {
            toast.success(`Stream "${updatedStreamData.name}" archived.`);
            queryClient.invalidateQueries({ queryKey: ['myStreams'] });
            queryClient.invalidateQueries({ queryKey: ['stream', streamId] });
        },
        onError: (err: Error) => toast.error(`Archive failed: ${err.message}`),
        onSettled: () => setIsArchiveConfirmOpen(false),
    });

    const unarchiveMutation = useMutation({
        mutationFn: () => streamService.unarchiveStream(streamId!),
        onSuccess: (updatedStreamData) => {
            toast.success(`Stream "${updatedStreamData.name}" unarchived.`);
            queryClient.invalidateQueries({ queryKey: ['myStreams'] });
            queryClient.invalidateQueries({ queryKey: ['stream', streamId] });
        },
        onError: (err: Error) => toast.error(`Unarchive failed: ${err.message}`),
    });


    if (isLoading) return <div className="text-center p-10">Loading stream details...</div>;
    if (error) return <div className="text-center p-10 text-red-500">Error: {error.message}</div>;
    if (!stream) return <div className="text-center p-10">Stream not found.</div>;
    if (!stream || !stream.members) {
        return <div>Loading member data or no members...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Stream Header */}
            <div className={`p-4 rounded-lg shadow ${stream.isArchived ? 'bg-gray-200 border-gray-300' : 'bg-white border-gray-200'}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <div>
                        <h1 className={`text-3xl font-bold ${stream.isArchived ? 'text-gray-500' : 'text-gray-800'}`}>{stream.name}</h1>
                        <p className={`text-sm ${stream.isArchived ? 'text-gray-400' : 'text-gray-500'}`}>
                            Code: <span className="font-mono bg-gray-100 px-1 rounded">{stream.streamCode}</span>
                            {stream.isArchived && <span className="ml-2 font-semibold text-gray-600">(Archived)</span>}
                        </p>
                    </div>
                    {/* Action Buttons */}
                    <div className="flex space-x-2 mt-2 sm:mt-0">
                        {isOwner && !stream.isArchived && (
                            <Button variant="outline" size="sm" onClick={() => setIsArchiveConfirmOpen(true)} disabled={archiveMutation.isPending}>
                                {archiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <Archive size={16} className="mr-1"/>} Archive
                            </Button>
                        )}
                        {isOwner && stream.isArchived && (
                            <Button variant="outline" size="sm" onClick={() => unarchiveMutation.mutate()} disabled={unarchiveMutation.isPending}>
                                 {unarchiveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <ArchiveRestore size={16} className="mr-1"/>} Unarchive
                            </Button>
                        )}
                        {!isOwner && !stream.isArchived && ( // Members can only leave active streams
                            <Button variant="destructive" size="sm" onClick={() => setIsLeaveConfirmOpen(true)} disabled={leaveMutation.isPending}>
                               {leaveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <LogOut size={16} className="mr-1"/>} Leave Stream
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 ${stream.isArchived ? 'opacity-60 pointer-events-none' : ''}`}>
                {/* Link Cards */}
                <Link to={`/streams/${streamId}/timetable`} className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <Clock className="w-8 h-8 text-indigo-500 mb-2" />
                    <h2 className="text-xl font-semibold mb-1">Timetables</h2>
                    <p className="text-sm text-gray-600">View and manage weekly schedules.</p>
                </Link>
                 <Link to={`/streams/${streamId}/attendance`} className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <Users className="w-8 h-8 text-emerald-500 mb-2" />
                    <h2 className="text-xl font-semibold mb-1">Attendance</h2>
                    <p className="text-sm text-gray-600">Track daily status and bulk entry.</p>
                </Link>
                 <Link to={`/streams/${streamId}/analytics`} className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <BarChart3 className="w-8 h-8 text-amber-500 mb-2" />
                    <h2 className="text-xl font-semibold mb-1">Analytics</h2>
                    <p className="text-sm text-gray-600">View stats and calculate projections.</p>
                </Link>
            </div>

            <div className={`bg-white p-6 rounded-lg shadow ${stream.isArchived ? 'opacity-60' : ''}`}>
                <h2 className="text-xl font-semibold mb-4">Members ({stream.members.length})</h2>
                <ul className="space-y-2 max-h-60 overflow-y-auto">
                    {stream.members.map(member => (
                        <li key={member.userId} className="flex justify-between items-center text-sm border-b pb-1">
                            <span>{member.user.name || member.user.email}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${member.role === 'admin' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                {member.role}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

        {/* Leave Stream Confirmation Dialog */}
            <Dialog open={isLeaveConfirmOpen} onOpenChange={setIsLeaveConfirmOpen}>
                <DialogContent>
                    <DialogHeader> <DialogTitle className="flex items-center"><AlertTriangle className="text-red-500 mr-2"/> Confirm Leave Stream</DialogTitle> </DialogHeader>
                    <DialogDescription>Are you sure you want to leave the stream "{stream.name}"?</DialogDescription>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsLeaveConfirmOpen(false)} disabled={leaveMutation.isPending}>Cancel</Button>
                        <Button variant="destructive" onClick={() => leaveMutation.mutate()} disabled={leaveMutation.isPending}>
                            {leaveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Leaving...</> : 'Yes, Leave'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Archive Stream Confirmation Dialog */}
            <Dialog open={isArchiveConfirmOpen} onOpenChange={setIsArchiveConfirmOpen}>
                <DialogContent>
                    <DialogHeader> <DialogTitle className="flex items-center"><Archive className="text-orange-500 mr-2"/> Confirm Archive Stream</DialogTitle> </DialogHeader>
                    <DialogDescription>
                        Archiving "{stream.name}" will hide it from the main list for all members.
                        Timetables and attendance data will be preserved. You can unarchive it later. Are you sure?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsArchiveConfirmOpen(false)} disabled={archiveMutation.isPending}>Cancel</Button>
                        <Button variant="secondary" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => archiveMutation.mutate()} disabled={archiveMutation.isPending}>
                            {archiveMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Archiving...</> : 'Yes, Archive'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StreamPage;