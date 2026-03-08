import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProfileEditor from "./ProfileEditor";

export default function LearnerDashboard() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  useEffect(() => {
    fetchEnrollments();
  }, []);

  const fetchEnrollments = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("enrollments")
      .select("*, courses(*)")
      .eq("user_id", user.id);

    setEnrollments(data || []);
  };


  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">My Learning</h1>

      <Tabs defaultValue="courses" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-sm mb-8">
          <TabsTrigger value="courses">My Courses</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="courses">
          {enrollments.length === 0 ? (
            <Card className="shadow-soft">
              <CardContent className="py-12 text-center">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet.</p>
                <p className="text-sm text-muted-foreground">
                  Visit the <a href="/explore" className="text-primary hover:underline">Explore</a> page to discover courses!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrollments.map((enrollment) => (
                <Card key={enrollment.id} className="shadow-soft hover:shadow-hover transition-all cursor-pointer"
                  onClick={() => navigate(`/course/${enrollment.courses?.id}`)}>
                  <CardHeader>
                    <CardTitle>{enrollment.courses?.title}</CardTitle>
                    <CardDescription>{enrollment.courses?.category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-medium">{enrollment.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${enrollment.progress}%` }}
                        />
                      </div>
                      <Button className="w-full" size="sm">
                        Continue Learning
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>


        <TabsContent value="profile">
          <ProfileEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}