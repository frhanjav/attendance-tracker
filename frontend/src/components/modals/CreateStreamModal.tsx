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
const createStreamSchema = z.object({
    name: z.string().min(3, { message: 'Stream name must be at least 3 characters' }),
});
type CreateStreamFormInputs = z.infer<typeof createStreamSchema>;
// --- End Schema ---

interface CreateStreamModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateStreamModal: React.FC<CreateStreamModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [formError, setFormError] = useState<string | null>(null);

    // --- Form Setup ---
    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateStreamFormInputs>({
        resolver: zodResolver(createStreamSchema),
        defaultValues: { name: '' },
    });

    // --- React Query Mutation ---
    const createMutation = useMutation({
        mutationFn: streamService.createStream, // Function from stream service
        onSuccess: (data) => {
            toast.success(`Stream "${data.name}" created successfully! Code: ${data.streamCode}`);
            queryClient.invalidateQueries({ queryKey: ['myStreams'] }); // Refetch stream list
            handleClose(); // Close modal and reset form
        },
        onError: (error: Error) => {
            console.error("Create stream error:", error);
            setFormError(error.message || "Failed to create stream. Please try again.");
            toast.error(`Error: ${error.message}`);
        },
    });

    // --- Form Submit Handler ---
    const onSubmit = (data: CreateStreamFormInputs) => {
        setFormError(null); // Clear previous errors
        createMutation.mutate({ name: data.name.trim() });
    };

    // --- Close Handler (resets form) ---
    const handleClose = () => {
        reset(); // Reset form fields
        setFormError(null); // Clear errors
        onClose(); // Call parent's close handler
    };

    // Use Dialog's onOpenChange to handle closing via overlay click or escape key
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            handleClose();
        }
        // We don't need to handle the 'open' case here as it's controlled by the parent prop
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Stream</DialogTitle>
                    <DialogDescription>
                        Enter a name for your new stream (e.g., course name, class section). A unique join code will be generated.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="stream-name">Stream Name <span className="text-red-500">*</span></Label>
                        <Input
                            id="stream-name"
                            {...register('name')}
                            placeholder="e.g., B.Tech CSE Sem 4"
                            className={errors.name ? 'border-red-500' : ''}
                            disabled={createMutation.isPending}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                    </div>

                    {/* Display Form Error */}
                    {formError && (
                         <p className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">{formError}</p>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={handleClose} disabled={createMutation.isPending}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
                            {createMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</> : 'Create Stream'}
                        </Button>
                    </DialogFooter>
                </form>

            </DialogContent>
        </Dialog>
    );
};

export default CreateStreamModal;