import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { streamService } from '../../services/stream.service'; // Adjust import path
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose,
} from "../../components/ui/dialog";
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// --- Zod Schema for Form Validation ---
const joinStreamSchema = z.object({
    streamCode: z.string().min(5, { message: 'Stream code seems too short' }) // Basic length check
        .max(50, { message: 'Stream code seems too long' }) // Basic length check
        .regex(/^[a-zA-Z0-9-]+$/, { message: 'Code should only contain letters, numbers, or hyphens' }), // Example regex, adjust if needed
});
type JoinStreamFormInputs = z.infer<typeof joinStreamSchema>;
// --- End Schema ---

interface JoinStreamModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const JoinStreamModal: React.FC<JoinStreamModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [formError, setFormError] = useState<string | null>(null);

    // --- Form Setup ---
    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<JoinStreamFormInputs>({
        resolver: zodResolver(joinStreamSchema),
        defaultValues: { streamCode: '' },
    });

    // --- React Query Mutation ---
    const joinMutation = useMutation({
        mutationFn: streamService.joinStream, // Function from stream service
        onSuccess: (data) => {
            toast.success(`Successfully joined stream "${data.name}"!`);
            queryClient.invalidateQueries({ queryKey: ['myStreams'] }); // Refetch stream list
            handleClose(); // Close modal and reset form
        },
        onError: (error: Error) => {
            console.error("Join stream error:", error);
            setFormError(error.message || "Failed to join stream. Check the code or try again.");
            toast.error(`Error: ${error.message}`);
        },
    });

    // --- Form Submit Handler ---
    const onSubmit = (data: JoinStreamFormInputs) => {
        setFormError(null);
        joinMutation.mutate({ streamCode: data.streamCode.trim() });
    };

    // --- Close Handler (resets form) ---
    const handleClose = () => {
        reset();
        setFormError(null);
        onClose();
    };

     // Use Dialog's onOpenChange to handle closing
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            handleClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Join Stream</DialogTitle>
                    <DialogDescription>
                        Enter the unique code provided by the stream administrator to join.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="stream-code">Stream Code <span className="text-red-500">*</span></Label>
                        <Input
                            id="stream-code"
                            {...register('streamCode')}
                            placeholder="Enter join code"
                            className={errors.streamCode ? 'border-red-500' : ''}
                            disabled={joinMutation.isPending}
                        />
                        {errors.streamCode && <p className="text-red-500 text-xs mt-1">{errors.streamCode.message}</p>}
                    </div>

                    {/* Display Form Error */}
                    {formError && (
                         <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{formError}</p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={handleClose} disabled={joinMutation.isPending}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || joinMutation.isPending}>
                            {joinMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining...</> : 'Join Stream'}
                        </Button>
                    </DialogFooter>
                </form>

            </DialogContent>
        </Dialog>
    );
};

export default JoinStreamModal;