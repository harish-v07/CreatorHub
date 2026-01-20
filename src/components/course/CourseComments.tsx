import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, ArrowUpDown } from "lucide-react";
import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";

interface CourseCommentsProps {
    courseId: string;
    lessonId: string;
    courseCreatorId: string;
}

export function CourseComments({ courseId, lessonId, courseCreatorId }: CourseCommentsProps) {
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string>("");
    const [sortNewest, setSortNewest] = useState(true);

    useEffect(() => {
        fetchComments();
        getCurrentUser();

        // Subscribe to real-time updates
        const channel = supabase
            .channel(`lesson_comments:${lessonId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "course_comments",
                    filter: `lesson_id=eq.${lessonId}`,
                },
                () => {
                    fetchComments();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [lessonId, sortNewest]);

    const getCurrentUser = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (user) {
            setCurrentUserId(user.id);
        }
    };

    const fetchComments = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from("course_comments")
            .select(`
                *,
                profiles (
                    id,
                    name,
                    avatar_url
                )
            `)
            .eq("lesson_id", lessonId)
            .is("parent_comment_id", null)
            .order("created_at", { ascending: !sortNewest });

        if (error) {
            console.error("Error fetching comments:", error);
            toast.error("Failed to load comments");
        } else {
            console.log("Fetched comments:", data); // Debug log

            // Fetch replies for each comment
            const commentsWithReplies = await Promise.all(
                (data || []).map(async (comment) => {
                    const { data: replies } = await supabase
                        .from("course_comments")
                        .select(`
                            *,
                            profiles (
                                id,
                                name,
                                avatar_url
                            )
                        `)
                        .eq("parent_comment_id", comment.id)
                        .order("created_at", { ascending: true });

                    return { ...comment, replies: replies || [] };
                })
            );

            console.log("Comments with replies:", commentsWithReplies); // Debug log
            setComments(commentsWithReplies);
        }

        setLoading(false);
    };

    const handleCommentAdded = () => {
        fetchComments();
    };

    const handleCommentDeleted = () => {
        fetchComments();
    };

    const toggleSort = () => {
        setSortNewest(!sortNewest);
    };

    return (
        <Card className="shadow-soft mt-6">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5" />
                            Discussion
                        </CardTitle>
                        <CardDescription>
                            {comments.length} {comments.length === 1 ? "comment" : "comments"}
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={toggleSort}>
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        {sortNewest ? "Newest First" : "Oldest First"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <CommentForm
                        courseId={courseId}
                        lessonId={lessonId}
                        onSuccess={handleCommentAdded}
                    />

                    <div className="border-t pt-4">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Loading comments...
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No comments yet. Be the first to start the discussion!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {comments.map((comment) => (
                                    <CommentItem
                                        key={comment.id}
                                        comment={comment}
                                        currentUserId={currentUserId}
                                        courseCreatorId={courseCreatorId}
                                        onCommentAdded={handleCommentAdded}
                                        onCommentDeleted={handleCommentDeleted}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
