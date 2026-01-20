import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CommentFormProps {
    courseId: string;
    lessonId: string;
    parentCommentId?: string;
    onSuccess: () => void;
    onCancel?: () => void;
    placeholder?: string;
}

export function CommentForm({
    courseId,
    lessonId,
    parentCommentId,
    onSuccess,
    onCancel,
    placeholder = "Ask a question or share your thoughts...",
}: CommentFormProps) {
    const [content, setContent] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!content.trim()) {
            toast.error("Please enter a comment");
            return;
        }

        setIsSubmitting(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            toast.error("You must be logged in to comment");
            setIsSubmitting(false);
            return;
        }

        const { error } = await supabase.from("course_comments").insert({
            course_id: courseId,
            lesson_id: lessonId,
            user_id: user.id,
            parent_comment_id: parentCommentId || null,
            content: content.trim(),
        });

        if (error) {
            toast.error("Failed to post comment");
            console.error(error);
        } else {
            toast.success(parentCommentId ? "Reply posted!" : "Comment posted!");
            setContent("");
            onSuccess();
        }

        setIsSubmitting(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={placeholder}
                className="min-h-[80px] resize-none"
                maxLength={2000}
                disabled={isSubmitting}
            />

            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {content.length}/2000
                </span>

                <div className="flex gap-2">
                    {onCancel && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                    )}
                    <Button type="submit" size="sm" disabled={isSubmitting || !content.trim()}>
                        {isSubmitting ? "Posting..." : parentCommentId ? "Reply" : "Post Comment"}
                    </Button>
                </div>
            </div>
        </form>
    );
}
