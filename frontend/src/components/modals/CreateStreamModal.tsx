import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { streamService } from '../../services/stream.service';

const createStreamSchema = z.object({
    name: z.string().min(3, { message: 'Stream name must be at least 3 characters' }),
});
type CreateStreamFormInputs = z.infer<typeof createStreamSchema>;

interface CreateStreamModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateStreamModal: React.FC<CreateStreamModalProps> = ({ isOpen, onClose }) => {
    const queryClient = useQueryClient();
    const [formError, setFormError] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateStreamFormInputs>({
        resolver: zodResolver(createStreamSchema),
        defaultValues: { name: '' },
    });

    const createMutation = useMutation({
        mutationFn: streamService.createStream,
        onSuccess: (data) => {
            toast.success(`Stream "${data.name}" created successfully! Code: ${data.streamCode}`);
            queryClient.invalidateQueries({ queryKey: ['myStreams'] });
            queryClient.invalidateQueries({ queryKey: ['myStreamsDashboard'] });
            handleClose();
        },
        onError: (error: Error) => {
            console.error("Create stream error:", error);
            setFormError(error.message || "Failed to create stream. Please try again.");
            toast.error(`Error: ${error.message}`);
        },
    });

    const onSubmit = (data: CreateStreamFormInputs) => {
        setFormError(null);
        createMutation.mutate({ name: data.name.trim() });
    };

    const handleClose = () => {
        reset();
        setFormError(null);
        onClose();
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            handleClose();
        }
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
                        <div className='mb-2'><Label htmlFor="stream-name">Stream Name <span className="text-red-500">*</span></Label></div>
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